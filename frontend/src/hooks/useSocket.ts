"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";
import type { Landmark, PredictionResult } from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export function useSocket(onPrediction?: (result: PredictionResult) => void) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("prediction", (data: PredictionResult) => {
      onPrediction?.(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, onPrediction]);

  const predict = useCallback(
    (landmarks: Landmark[], appendToText?: string) => {
      return new Promise<PredictionResult>((resolve, reject) => {
        if (!socketRef.current?.connected) {
          reject(new Error("Socket not connected"));
          return;
        }
        socketRef.current.emit(
          "predict",
          { landmarks, appendToText },
          (response: { success: boolean; data?: PredictionResult; error?: string }) => {
            if (response.success && response.data) {
              resolve(response.data);
            } else {
              reject(new Error(response.error ?? "Prediction failed"));
            }
          }
        );
      });
    },
    []
  );

  return { connected, predict };
}
