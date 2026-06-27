"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import type { Landmark } from "@/types";

// MediaPipe Hands runs in browser via CDN script for landmark extraction
declare global {
  interface Window {
    Hands: new (config: Record<string, unknown>) => {
      setOptions: (opts: Record<string, unknown>) => void;
      onResults: (cb: (results: MediaPipeResults) => void) => void;
      send: (input: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
      close: () => void;
    };
  }
}

interface MediaPipeResults {
  multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
}

export function useHandLandmarks(enabled: boolean) {
  const webcamRef = useRef<Webcam>(null);
  const handsRef = useRef<InstanceType<typeof window.Hands> | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "idle" | "prompt" | "granted" | "denied"
  >("idle");
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("mediapipe-hands")) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "mediapipe-hands";
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!enabled || !scriptLoaded || typeof window === "undefined" || !window.Hands) return;

    const hands = new window.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: MediaPipeResults) => {
      if (results.multiHandLandmarks?.[0]) {
        const lm = results.multiHandLandmarks[0].map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        setLandmarks(lm);
      } else {
        setLandmarks(null);
      }
    });

    handsRef.current = hands;

    const processFrame = async () => {
      const video = webcamRef.current?.video;
      if (video && video.readyState === 4 && handsRef.current) {
        await handsRef.current.send({ image: video });
      }
      animationRef.current = requestAnimationFrame(processFrame);
    };

    animationRef.current = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationRef.current);
      hands.close();
      handsRef.current = null;
    };
  }, [enabled, scriptLoaded]);

  const captureImage = useCallback((): string | null => {
    const screenshot = webcamRef.current?.getScreenshot();
    return screenshot ?? null;
  }, []);

  return { webcamRef, landmarks, captureImage, scriptLoaded, cameraPermission, setCameraPermission };
}
