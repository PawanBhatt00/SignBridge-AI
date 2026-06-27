"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Camera, CameraOff, Mic, MicOff, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useHandLandmarks } from "@/hooks/useHandLandmarks";
import { useSocket } from "@/hooks/useSocket";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useTranslatorStore } from "@/store/translator";
import type { PredictionResult } from "@/types";

const PREDICTION_INTERVAL_MS = 800;
// FIX 2: Lowered threshold from 0.70 to 0.55 so more real-world signs get accepted
const CONFIDENCE_THRESHOLD = 0.55;

export function TranslatorView() {
  const accessToken = useAuthStore((s) => s.accessToken);
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

  const { webcamRef, landmarks, scriptLoaded, cameraPermission, setCameraPermission } =
    useHandLandmarks(isActive);
  const { speak, stop } = useTextToSpeech();
  const lastPredictionTime = useRef(0);
  const lastChar = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // FIX 3: Use a ref for currentText inside the callback so it never causes re-renders
  const currentTextRef = useRef(currentText);
  useEffect(() => {
    currentTextRef.current = currentText;
  }, [currentText]);

  const handlePrediction = useCallback(
    (result: PredictionResult) => {
      setLastPrediction(result);
      setConfidence(result.confidence);

      if (
        result.prediction &&
        result.confidence >= CONFIDENCE_THRESHOLD &&
        result.prediction !== lastChar.current
      ) {
        lastChar.current = result.prediction;
        // Use ref instead of state to avoid stale closure
        const newText = result.fullText ?? currentTextRef.current + result.prediction;
        setCurrentText(newText);
        speak(result.prediction);
      }
    },
    // FIX 3: Removed currentText from deps — use ref instead
    [setCurrentText, setLastPrediction, setConfidence, speak]
  );

  const { connected, predict } = useSocket(handlePrediction);

  // FIX 3: Use refs for connected and predict too to avoid interval restarts
  const connectedRef = useRef(connected);
  const predictRef = useRef(predict);
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { predictRef.current = predict; }, [predict]);

  const landmarksRef = useRef(landmarks);
  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);

  const accessTokenRef = useRef(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // FIX 1: Single stable interval — reads all values from refs, no deps that change
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      const lm = landmarksRef.current;
      const token = accessTokenRef.current;

      if (!lm || !token || lm.length !== 21) return;

      const now = Date.now();
      if (now - lastPredictionTime.current < PREDICTION_INTERVAL_MS) return;
      lastPredictionTime.current = now;

      try {
        setError(null);
        setIsPredicting(true);

        if (connectedRef.current) {
          await predictRef.current(lm, currentTextRef.current);
        } else {
          const result = await api.translate(token, {
            landmarks: lm,
            appendToText: currentTextRef.current,
          });
          handlePrediction(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Prediction failed");
      } finally {
        setIsPredicting(false);
      }
    }, PREDICTION_INTERVAL_MS);

    return () => clearInterval(interval);
    // FIX 1: Only depends on isActive — interval never restarts unnecessarily
  }, [isActive, handlePrediction]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Webcam Feed</span>
            <div className="flex gap-2">
              <Button
                variant={isActive ? "destructive" : "default"}
                size="sm"
                onClick={() => setActive(!isActive)}
                aria-label={isActive ? "Stop camera" : "Start camera"}
              >
                {isActive ? (
                  <CameraOff className="h-4 w-4" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {isActive ? "Stop" : "Start"}
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
                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                className="w-full h-full object-cover"
                onUserMedia={() => setCameraPermission("granted")}
                onUserMediaError={() => setCameraPermission("denied")}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Camera className="h-12 w-12 opacity-50" />
                <span className="ml-3">Click Start to enable webcam</span>
              </div>
            )}
            {landmarks && isActive && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">
                Hand detected
              </div>
            )}
          </div>
          {!scriptLoaded && isActive && (
            <p className="text-sm text-muted-foreground mt-2">Loading hand detection...</p>
          )}
          {isActive && cameraPermission === "denied" && (
            <p className="text-sm text-destructive mt-2" role="alert">
              Camera permission denied. Allow camera access to detect signs.
            </p>
          )}
          {isActive && cameraPermission === "granted" && !landmarks && scriptLoaded && (
            <p className="text-sm text-muted-foreground mt-2">Show your hand to the camera</p>
          )}
          {error && <p className="text-sm text-destructive mt-2" role="alert">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Translation Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-background/40 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Detected sign</span>
              {isPredicting && (
                <span className="text-xs text-muted-foreground animate-pulse">Recognizing...</span>
              )}
            </div>
            <div className="flex items-end justify-between gap-4">
              <span className="text-5xl font-bold tracking-widest">
                {lastPrediction?.prediction || "—"}
              </span>
              <span className="text-sm text-muted-foreground pb-1">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <Progress value={confidence * 100} aria-label="Confidence level" />
          </div>

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

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => speak(currentText)}
              disabled={!currentText || isSpeaking}
              aria-label="Speak translation"
            >
              {isSpeaking ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              Speak
            </Button>
            <Button variant="secondary" size="sm" onClick={stop} disabled={!isSpeaking}>
              Stop Speech
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                lastChar.current = "";
                clearText();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                lastChar.current = "";
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset Letter
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Socket: {connected ? "Connected" : "REST fallback"} · ASL Alphabet (A-Z)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}