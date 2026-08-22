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

  const accessToken = useAuthStore((state) => state.accessToken);

  const onPredictionRef = useRef(onPrediction);

  /*
   * Keep the latest prediction callback without
   * recreating the socket connection.
   */
  useEffect(() => {
    onPredictionRef.current = onPrediction;
  }, [onPrediction]);

  /*
   * Create Socket.IO connection when authenticated.
   */
  useEffect(() => {
    if (!accessToken) {
      console.log(
        "[Socket] No access token. Connection skipped."
      );

      setConnected(false);
      return;
    }

    console.log("========================================");
    console.log("[Socket] Initializing connection");
    console.log("[Socket] URL:", SOCKET_URL);
    console.log(
      "[Socket] Token present:",
      Boolean(accessToken)
    );
    console.log("========================================");

    const socket: Socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },

      /*
       * Start with polling and allow Socket.IO
       * to upgrade to WebSocket.
       *
       * This is useful for diagnosing WebSocket
       * interruptions on Render.
       */
      transports: ["polling", "websocket"],

      upgrade: true,
      rememberUpgrade: false,

      /*
       * Connection timeout.
       */
      timeout: 20000,

      /*
       * Reconnection configuration.
       */
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });

    /*
     * --------------------------------------------------
     * CONNECT
     * --------------------------------------------------
     */
    socket.on("connect", () => {
      console.log("========================================");
      console.log("[Socket] CONNECTED");
      console.log("[Socket] Socket ID:", socket.id);
      console.log(
        "[Socket] Transport:",
        socket.io.engine.transport.name
      );
      console.log("========================================");

      setConnected(true);
    });

    /*
     * --------------------------------------------------
     * TRANSPORT UPGRADE
     * --------------------------------------------------
     *
     * Normally:
     *
     * polling -> websocket
     */
    socket.io.engine.on("upgrade", () => {
      console.log(
        "[Socket] Transport upgraded to:",
        socket.io.engine.transport.name
      );
    });

    /*
     * --------------------------------------------------
     * DISCONNECT
     * --------------------------------------------------
     */
    socket.on("disconnect", (reason, details) => {
      console.log("========================================");
      console.log("[Socket] DISCONNECTED");
      console.log("[Socket] Socket ID:", socket.id);
      console.log("[Socket] Reason:", reason);

      /*
       * Do not access details.message or
       * details.description directly because
       * Socket.IO types this as a union.
       */
      if (details) {
        console.log(
          "[Socket] Disconnect details:",
          details
        );
      }

      console.log("========================================");

      setConnected(false);
    });

    /*
     * --------------------------------------------------
     * CONNECTION ERROR
     * --------------------------------------------------
     */
    socket.on("connect_error", (error) => {
      console.error("========================================");
      console.error("[Socket] CONNECTION ERROR");
      console.error(
        "[Socket] Message:",
        error.message
      );
      console.error("[Socket] Error:", error);
      console.error("========================================");

      setConnected(false);
    });

    /*
     * --------------------------------------------------
     * GENERAL SOCKET ERROR
     * --------------------------------------------------
     */
    socket.on("error", (error) => {
      console.error(
        "[Socket] Socket error:",
        error
      );
    });

    /*
     * --------------------------------------------------
     * PREDICTION EVENT
     * --------------------------------------------------
     */
    socket.on(
      "prediction",
      (data: PredictionResult) => {
        console.log(
          "[Socket] Prediction received:",
          data
        );

        onPredictionRef.current?.(data);
      }
    );

    socketRef.current = socket;

    /*
     * --------------------------------------------------
     * CLEANUP
     * --------------------------------------------------
     */
    return () => {
      console.log(
        "[Socket] Cleaning up socket connection"
      );

      /*
       * Remove listeners registered by this hook.
       */
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("error");
      socket.off("prediction");

      /*
       * Disconnect this socket.
       */
      socket.disconnect();

      /*
       * Only clear the ref if this is still
       * the active socket.
       */
      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setConnected(false);
    };
  }, [accessToken]);

  /*
   * ----------------------------------------------------
   * PREDICT
   * ----------------------------------------------------
   */
  const predict = useCallback(
    (
      landmarks: Landmark[],
      appendToText?: string
    ) => {
      return new Promise<PredictionResult>(
        (resolve, reject) => {
          const socket = socketRef.current;

          /*
           * Socket instance check.
           */
          if (!socket) {
            reject(
              new Error(
                "Socket instance not available"
              )
            );
            return;
          }

          /*
           * Connection check.
           */
          if (!socket.connected) {
            reject(
              new Error(
                "Socket not connected"
              )
            );
            return;
          }

          /*
           * Landmark validation.
           */
          if (
            !landmarks ||
            landmarks.length !== 21
          ) {
            reject(
              new Error(
                `Invalid landmarks: expected 21, received ${
                  landmarks?.length ?? 0
                }`
              )
            );
            return;
          }

          console.log(
            "[Socket] Sending prediction request"
          );

          socket
            .timeout(10000)
            .emit(
              "predict",
              {
                landmarks,
                appendToText,
              },
              (
                error: Error | null,
                response: SocketPredictResponse
              ) => {
                /*
                 * Timeout/error.
                 */
                if (error) {
                  console.error(
                    "[Socket] Prediction request failed:",
                    error.message
                  );

                  reject(
                    new Error(
                      "Socket prediction timed out"
                    )
                  );

                  return;
                }

                /*
                 * No response.
                 */
                if (!response) {
                  console.error(
                    "[Socket] No prediction response received"
                  );

                  reject(
                    new Error(
                      "No response from server"
                    )
                  );

                  return;
                }

                /*
                 * Successful response.
                 */
                if (
                  response.success &&
                  response.data
                ) {
                  resolve(response.data);
                  return;
                }

                /*
                 * Server-side prediction error.
                 */
                reject(
                  new Error(
                    response.error ??
                      "Prediction failed"
                  )
                );
              }
            );
        }
      );
    },
    []
  );

  return {
    connected,
    predict,
  };
}