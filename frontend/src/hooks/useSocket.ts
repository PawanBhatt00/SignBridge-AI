"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";
import type { Landmark, PredictionResult } from "@/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

type SocketPredictResponse = {
  success: boolean;
  data?: PredictionResult;
  error?: string;
};

export function useSocket(
  onPrediction?: (result: PredictionResult) => void
) {
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);

  const accessToken = useAuthStore((s) => s.accessToken);

  const onPredictionRef = useRef(onPrediction);

  useEffect(() => {
    onPredictionRef.current = onPrediction;
  }, [onPrediction]);

  useEffect(() => {
    if (!accessToken) {
      setConnected(false);
      return;
    }

    console.log("[Socket] Connecting to:", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },

      transports: ["websocket", "polling"],

      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      setConnected(false);
    });

    socket.on("error", (error) => {
      console.error("[Socket] Error:", error);
    });

    socket.on("prediction", (data: PredictionResult) => {
      onPredictionRef.current?.(data);
    });

    socketRef.current = socket;

    return () => {
      console.log("[Socket] Cleaning up");

      socket.removeAllListeners();
      socket.disconnect();

      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken]);

  const predict = useCallback(
    (landmarks: Landmark[], appendToText?: string) => {
      return new Promise<PredictionResult>((resolve, reject) => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
          reject(new Error("Socket not connected"));
          return;
        }

        socket.timeout(10000).emit(
          "predict",
          {
            landmarks,
            appendToText,
          },
          (error: Error | null, response: SocketPredictResponse) => {
            if (error) {
              reject(new Error("Socket prediction timed out"));
              return;
            }

            if (!response) {
              reject(new Error("No response from server"));
              return;
            }

            if (response.success && response.data) {
              resolve(response.data);
              return;
            }

            reject(
              new Error(response.error ?? "Prediction failed")
            );
          }
        );
      });
    },
    []
  );

  return {
    connected,
    predict,
  };
}