"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { useHandLandmarks } from "@/hooks/useHandLandmarks";
import { useSocket } from "@/hooks/useSocket";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useTranslatorStore } from "@/store/translator";

import type { PredictionResult } from "@/types";

/*
 * ============================================================
 * Prediction configuration
 * ============================================================
 *
 * We intentionally do NOT predict every 500-800ms.
 *
 * Production has network latency and the backend has rate limits.
 * 1200ms gives us around 50 prediction attempts/minute at most.
 *
 * More importantly, below we make sure that a new request is
 * NEVER started while the previous request is still running.
 */
/*
 * Backend allows 200 requests / 900s (15 min) — see rate limit
 * headers from production 429 responses:
 *   ratelimit-limit: 200
 *   ratelimit-policy: 200;w=900
 *
 * At 800ms this loop was sending ~1125 requests/15min, which blows
 * through that budget in under 3 minutes. 2500ms keeps REST fallback
 * usage under budget (~360 req/15min ceiling, further reduced by the
 * in-flight lock and the fact that WebSocket should normally be
 * carrying the load instead of REST).
 */
const PREDICTION_INTERVAL_MS = 2500;

/*
 * Minimum confidence required before accepting a prediction.
 */
const CONFIDENCE_THRESHOLD = 0.55;

/*
 * Require the same prediction this many consecutive times before
 * accepting it. A single 99%-confidence frame can still be a
 * momentary misread; requiring repetition makes the translator
 * noticeably more stable on a live webcam feed.
 */
const REQUIRED_STABLE_PREDICTIONS = 2;

/*
 * If the server responds with 429, wait this long before trying
 * again.
 *
 * 10 seconds is intentionally conservative.
 */
const RATE_LIMIT_BACKOFF_MS = 10_000;


export function TranslatorView() {
  /*
   * ============================================================
   * Authentication
   * ============================================================
   */

  const accessToken = useAuthStore((s) => s.accessToken);


  /*
   * ============================================================
   * Translator store
   * ============================================================
   */

  const {
    isActive,
    currentText,
    lastPrediction,
    confidence,
    isSpeaking,

    setActive,
    setCurrentText,
    clearText,
    setLastPrediction,
    setConfidence,
  } = useTranslatorStore();


  /*
   * ============================================================
   * Camera / hand landmarks
   * ============================================================
   */

  const {
    webcamRef,
    landmarks,
    scriptLoaded,
    cameraPermission,
    setCameraPermission,
  } = useHandLandmarks(isActive);


  /*
   * ============================================================
   * Text-to-speech
   * ============================================================
   */

  const { speak, stop } = useTextToSpeech();


  /*
   * ============================================================
   * Local UI state
   * ============================================================
   */

  const [error, setError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);


  /*
   * ============================================================
   * IMPORTANT REFS (part 1)
   * ============================================================
   *
   * These refs allow the prediction loop to always use the latest
   * values without recreating the prediction loop every render.
   *
   * NOTE: `connected` and `predict` come from useSocket(), which
   * needs `handlePrediction` as an argument. So those two refs
   * are declared further below, AFTER handlePrediction and the
   * useSocket() call. Declaring them here would reference
   * `connected`/`predict` before their `const` initialization
   * runs, which throws a ReferenceError (temporal dead zone).
   */


  // Current translated text
  const currentTextRef = useRef(currentText);

  useEffect(() => {
    currentTextRef.current = currentText;
  }, [currentText]);


  // Latest landmarks
  const landmarksRef = useRef(landmarks);

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);


  // Latest authentication token
  const accessTokenRef = useRef(accessToken);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);


  /*
   * ============================================================
   * Prediction state refs
   * ============================================================
   */


  /*
   * This is VERY IMPORTANT.
   *
   * It prevents:
   *
   * Request 1
   * Request 2
   * Request 3
   * Request 4
   *
   * from running simultaneously.
   *
   * Only one prediction request can exist at a time.
   */
  const predictionInFlightRef = useRef(false);


  /*
   * Used to stop an old timeout when the component becomes
   * inactive/unmounts.
   */
  const predictionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );


  /*
   * Used to prevent duplicate letters.
   *
   * Example:
   *
   * B B B B B
   *
   * becomes:
   *
   * B
   *
   * until the user presses Reset Letter.
   */
  const lastChar = useRef("");


  /*
   * Stability tracking.
   *
   * We don't accept a letter the first time we see it — we wait
   * until it's been predicted REQUIRED_STABLE_PREDICTIONS times in
   * a row, to filter out momentary misreads.
   */
  const candidateCharRef = useRef("");
  const candidateCountRef = useRef(0);


  /*
   * Used to prevent prediction immediately after starting.
   */
  const lastPredictionTime = useRef(0);


  /*
   * ============================================================
   * Prediction error / rate-limit handling
   * ============================================================
   */

  const rateLimitUntilRef = useRef(0);


  /*
   * ============================================================
   * Handle prediction result
   * ============================================================
   *
   * Defined BEFORE useSocket() because useSocket needs this
   * callback as an argument.
   */

  const handlePrediction = useCallback(
    (result: PredictionResult) => {
      /*
       * Always update the latest prediction shown in the UI.
       */
      setLastPrediction(result);

      /*
       * Always update confidence shown in the UI.
       */
      setConfidence(result.confidence);


      /*
       * Ignore low-confidence / empty predictions, and reset
       * stability tracking so a bad frame doesn't count toward
       * the next real letter.
       */
      if (
        !result.prediction ||
        result.confidence < CONFIDENCE_THRESHOLD
      ) {
        candidateCharRef.current = "";
        candidateCountRef.current = 0;
        return;
      }


      const prediction = result.prediction;


      /*
       * New candidate letter — start counting from 1.
       */
      if (candidateCharRef.current !== prediction) {
        candidateCharRef.current = prediction;
        candidateCountRef.current = 1;
        return;
      }


      /*
       * Same candidate seen again — count it.
       */
      candidateCountRef.current += 1;


      /*
       * Not stable yet — wait for more consecutive matches.
       */
      if (candidateCountRef.current < REQUIRED_STABLE_PREDICTIONS) {
        return;
      }


      /*
       * Don't append the same letter repeatedly.
       */
      if (prediction === lastChar.current) {
        return;
      }


      /*
       * Remember this letter.
       */
      lastChar.current = prediction;


      /*
       * Use server-provided fullText when available.
       *
       * Otherwise append the new prediction to the current text.
       */
      const newText =
        result.fullText ??
        currentTextRef.current + prediction;


      /*
       * Update text.
       */
      setCurrentText(newText);


      /*
       * Keep ref synchronized immediately.
       *
       * This is useful because the next prediction can happen before
       * React finishes the state update.
       */
      currentTextRef.current = newText;


      /*
       * Speak the newly accepted letter.
       */
      speak(prediction);


      /*
       * Reset the candidate counter so the same letter can be
       * accepted again after an intervening different letter
       * (e.g. B -> A -> B).
       */
      candidateCharRef.current = "";
      candidateCountRef.current = 0;
    },
    [
      setCurrentText,
      setLastPrediction,
      setConfidence,
      speak,
    ]
  );


  /*
   * ============================================================
   * Socket
   * ============================================================
   *
   * Must come after handlePrediction is defined, since it's
   * passed in as an argument here.
   */

  const { connected, predict } = useSocket(handlePrediction);


  /*
   * ============================================================
   * IMPORTANT REFS (part 2)
   * ============================================================
   *
   * Now that `connected` and `predict` exist, we can safely
   * mirror them into refs for the prediction loop below.
   */


  // Latest socket connection state
  const connectedRef = useRef(connected);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);


  // Latest socket prediction function
  const predictRef = useRef(predict);

  useEffect(() => {
    predictRef.current = predict;
  }, [predict]);


  /*
   * ============================================================
   * Main prediction loop
   * ============================================================
   *
   * IMPORTANT:
   *
   * We deliberately use setTimeout instead of setInterval.
   *
   * setInterval can create:
   *
   * Request 1 ────────────────>
   *       Request 2 ────────────────>
   *             Request 3 ────────────────>
   *
   * if the network is slow.
   *
   * Our implementation waits until the current request finishes
   * before scheduling the next request.
   *
   * Therefore:
   *
   * Request 1 ─────>
   *                 finished
   *                    ↓
   * Request 2 ─────>
   *                 finished
   *                    ↓
   * Request 3 ─────>
   *
   * ============================================================
   */

  useEffect(() => {
    /*
     * If translator isn't active, don't start anything.
     */
    if (!isActive) {
      return;
    }


    /*
     * Cancel any previous timer.
     */
    if (predictionTimerRef.current) {
      clearTimeout(predictionTimerRef.current);
      predictionTimerRef.current = null;
    }


    let cancelled = false;


    /*
     * Main prediction function.
     */
    const runPrediction = async () => {
      /*
       * Stop if component was unmounted or translator stopped.
       */
      if (cancelled) {
        return;
      }


      /*
       * If another request is already running, don't start another.
       */
      if (predictionInFlightRef.current) {
        predictionTimerRef.current = setTimeout(
          runPrediction,
          300
        );

        return;
      }


      /*
       * Check whether we're currently rate-limited.
       */
      const now = Date.now();

      if (now < rateLimitUntilRef.current) {
        const remaining =
          rateLimitUntilRef.current - now;

        predictionTimerRef.current = setTimeout(
          runPrediction,
          remaining
        );

        return;
      }


      /*
       * Get latest values.
       */
      const lm = landmarksRef.current;
      const token = accessTokenRef.current;


      /*
       * We need valid hand landmarks.
       */
      if (!lm || lm.length !== 21) {
        predictionTimerRef.current = setTimeout(
          runPrediction,
          PREDICTION_INTERVAL_MS
        );

        return;
      }


      /*
       * REST fallback requires authentication.
       *
       * Socket prediction may not require the token directly.
       */
      if (!token && !connectedRef.current) {
        setError("Authentication required for prediction.");

        predictionTimerRef.current = setTimeout(
          runPrediction,
          PREDICTION_INTERVAL_MS
        );

        return;
      }


      /*
       * Optional timing protection.
       */
      if (
        now - lastPredictionTime.current <
        PREDICTION_INTERVAL_MS
      ) {
        predictionTimerRef.current = setTimeout(
          runPrediction,
          PREDICTION_INTERVAL_MS
        );

        return;
      }


      /*
       * Record request start time.
       */
      lastPredictionTime.current = now;


      /*
       * Mark request as running.
       *
       * THIS IS THE MAIN FIX FOR YOUR 429 PROBLEM.
       */
      predictionInFlightRef.current = true;


      setError(null);
      setIsPredicting(true);


      try {
        /*
         * ========================================================
         * SOCKET PATH
         * ========================================================
         */

        if (connectedRef.current) {
          await predictRef.current(
            lm,
            currentTextRef.current
          );
        } else {
          /*
           * ======================================================
           * REST FALLBACK
           * ======================================================
           */

          const result = await api.translate(
            token as string,
            {
              landmarks: lm,
              appendToText: currentTextRef.current,
            }
          );


          /*
           * Process REST result exactly like socket result.
           */
          handlePrediction(result);
        }
      } catch (err) {
        /*
         * Convert error into a useful message.
         */
        const message =
          err instanceof Error
            ? err.message
            : "Prediction failed";


        /*
         * ========================================================
         * RATE LIMIT HANDLING
         * ========================================================
         *
         * Your backend currently returns:
         *
         * HTTP 429
         *
         * Therefore we temporarily stop prediction attempts.
         */

        if (
          message.includes("429") ||
          message.toLowerCase().includes("too many requests") ||
          message.toLowerCase().includes("rate limit")
        ) {
          rateLimitUntilRef.current =
            Date.now() + RATE_LIMIT_BACKOFF_MS;


          setError(
            "Prediction service is temporarily rate-limited. Please wait a moment..."
          );
        } else {
          setError(message);
        }
      } finally {
        /*
         * VERY IMPORTANT:
         *
         * Allow the next prediction only after the current
         * request has completely finished.
         */
        predictionInFlightRef.current = false;

        setIsPredicting(false);


        /*
         * Schedule the NEXT prediction.
         *
         * We don't immediately start another request.
         */
        if (!cancelled) {
          predictionTimerRef.current = setTimeout(
            runPrediction,
            PREDICTION_INTERVAL_MS
          );
        }
      }
    };


    /*
     * Start the first prediction after the normal interval.
     *
     * This prevents immediately firing a request when the camera
     * starts.
     */
    predictionTimerRef.current = setTimeout(
      runPrediction,
      PREDICTION_INTERVAL_MS
    );


    /*
     * Cleanup.
     */
    return () => {
      cancelled = true;


      if (predictionTimerRef.current) {
        clearTimeout(predictionTimerRef.current);
        predictionTimerRef.current = null;
      }
    };
  }, [
    isActive,
    handlePrediction,
  ]);


  /*
   * ============================================================
   * Clear translation
   * ============================================================
   */

  const handleClear = useCallback(() => {
    /*
     * Allow the next detected letter to be accepted.
     */
    lastChar.current = "";
    candidateCharRef.current = "";
    candidateCountRef.current = 0;


    /*
     * Clear UI text.
     */
    clearText();


    /*
     * Synchronize ref immediately.
     */
    currentTextRef.current = "";
  }, [clearText]);


  /*
   * ============================================================
   * Reset current letter
   * ============================================================
   */

  const handleResetLetter = useCallback(() => {
    lastChar.current = "";
    candidateCharRef.current = "";
    candidateCountRef.current = 0;
  }, []);


  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="grid lg:grid-cols-2 gap-6">

      {/* ========================================================
          WEBCAM
          ======================================================== */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">

            <span>
              Webcam Feed
            </span>

            <div className="flex gap-2">

              <Button
                variant={
                  isActive
                    ? "destructive"
                    : "default"
                }
                size="sm"
                onClick={() =>
                  setActive(!isActive)
                }
                aria-label={
                  isActive
                    ? "Stop camera"
                    : "Start camera"
                }
              >

                {isActive ? (
                  <CameraOff className="h-4 w-4" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}

                {isActive
                  ? "Stop"
                  : "Start"}

              </Button>

            </div>

          </CardTitle>
        </CardHeader>


        <CardContent>

          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/50">

            {isActive ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "user",
                  width: 640,
                  height: 480,
                }}
                className="w-full h-full object-cover"

                onUserMedia={() =>
                  setCameraPermission("granted")
                }

                onUserMediaError={() =>
                  setCameraPermission("denied")
                }
              />
            ) : (

              <div className="flex items-center justify-center h-full text-muted-foreground">

                <Camera className="h-12 w-12 opacity-50" />

                <span className="ml-3">
                  Click Start to enable webcam
                </span>

              </div>
            )}


            {landmarks && isActive && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">

                Hand detected

              </div>
            )}

          </div>


          {!scriptLoaded && isActive && (
            <p className="text-sm text-muted-foreground mt-2">
              Loading hand detection...
            </p>
          )}


          {isActive &&
            cameraPermission === "denied" && (

              <p
                className="text-sm text-destructive mt-2"
                role="alert"
              >
                Camera permission denied. Allow camera
                access to detect signs.
              </p>
            )}


          {isActive &&
            cameraPermission === "granted" &&
            !landmarks &&
            scriptLoaded && (

              <p className="text-sm text-muted-foreground mt-2">
                Show your hand to the camera
              </p>
            )}


          {error && (
            <p
              className="text-sm text-destructive mt-2"
              role="alert"
            >
              {error}
            </p>
          )}

        </CardContent>
      </Card>


      {/* ========================================================
          TRANSLATION OUTPUT
          ======================================================== */}

      <Card>

        <CardHeader>

          <CardTitle>
            Translation Output
          </CardTitle>

        </CardHeader>


        <CardContent className="space-y-4">

          {/* ====================================================
              CURRENT PREDICTION
              ==================================================== */}

          <div className="rounded-lg border border-white/10 bg-background/40 p-4 space-y-2">

            <div className="flex items-center justify-between text-sm">

              <span className="text-muted-foreground">
                Detected sign
              </span>


              {isPredicting && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Recognizing...
                </span>
              )}

            </div>


            <div className="flex items-end justify-between gap-4">

              <span className="text-5xl font-bold tracking-widest">

                {lastPrediction?.prediction || "—"}

              </span>


              <span className="text-sm text-muted-foreground pb-1">

                {Math.round(
                  confidence * 100
                )}
                %

              </span>

            </div>


            <Progress
              value={confidence * 100}
              aria-label="Confidence level"
            />

          </div>


          {/* ====================================================
              TRANSLATED TEXT
              ==================================================== */}

          <div
            className="min-h-[120px] p-4 rounded-lg bg-background/50 border border-white/10 text-2xl font-mono tracking-wider"
            aria-live="polite"
            aria-atomic="true"
          >

            {currentText || (

              <span className="text-muted-foreground text-base">

                Sign letters to see translation here...

              </span>

            )}

          </div>


          {/* ====================================================
              CONTROLS
              ==================================================== */}

          <div className="flex flex-wrap gap-2">

            {/* SPEAK */}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                speak(currentText)
              }
              disabled={
                !currentText ||
                isSpeaking
              }
              aria-label="Speak translation"
            >

              {isSpeaking ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}

              Speak

            </Button>


            {/* STOP SPEECH */}

            <Button
              variant="secondary"
              size="sm"
              onClick={stop}
              disabled={!isSpeaking}
            >

              Stop Speech

            </Button>


            {/* CLEAR */}

            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
            >

              <Trash2 className="h-4 w-4" />

              Clear

            </Button>


            {/* RESET LETTER */}

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetLetter}
            >

              <RotateCcw className="h-4 w-4" />

              Reset Letter

            </Button>

          </div>


          {/* ====================================================
              CONNECTION STATUS
              ==================================================== */}

          <p className="text-xs text-muted-foreground">

            Socket:{" "}

            {connected
              ? "Connected"
              : "REST fallback"}

            {" · "}

            ASL Alphabet (A-Z)

          </p>

        </CardContent>

      </Card>

    </div>
  );
}