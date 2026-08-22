import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

import { config } from "../config";
import { translationService } from "../services/TranslationService";
import { Landmark } from "../types";
import { verifyAccessToken } from "../utils/jwt";

interface PredictPayload {
  landmarks: Landmark[];
  appendToText?: string;
}

interface PredictResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function setupSocketIO(
  httpServer: HttpServer
): Server {
  console.log("========================================");
  console.log(
    "[Socket] Initializing Socket.IO server"
  );
  console.log(
    "[Socket] CORS origin:",
    config.corsOrigin
  );
  console.log(
    "[Socket] Socket path: /socket.io"
  );
  console.log("========================================");

  const io = new Server(httpServer, {
    /*
     * --------------------------------------------------
     * CORS
     * --------------------------------------------------
     */
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },

    /*
     * Socket.IO endpoint.
     */
    transports: ["polling", "websocket"],

    /*
     * Allow WebSocket upgrade.
     */
    allowUpgrades: true,

    /*
     * Engine.IO heartbeat.
     */
    pingInterval: 25000,
    pingTimeout: 20000,

    /*
     * Connection recovery.
     */
    connectionStateRecovery: {
      maxDisconnectionDuration:
        2 * 60 * 1000,

      skipMiddlewares: false,
    },
  });

  /*
   * --------------------------------------------------
   * ENGINE.IO CONNECTION ERROR
   * --------------------------------------------------
   *
   * This catches low-level connection and
   * transport errors.
   */
  io.engine.on(
    "connection_error",
    (error) => {
      console.error(
        "========================================"
      );

      console.error(
        "[Socket] ENGINE CONNECTION ERROR"
      );

      console.error(
        "[Socket] Code:",
        error.code
      );

      console.error(
        "[Socket] Message:",
        error.message
      );

      console.error(
        "[Socket] Context:",
        error.context
      );

      console.error(
        "========================================"
      );
    }
  );

  /*
   * --------------------------------------------------
   * SOCKET AUTHENTICATION
   * --------------------------------------------------
   */
  io.use((socket, next) => {
    console.log(
      "========================================"
    );

    console.log(
      "[Socket] Authentication attempt"
    );

    console.log(
      "[Socket] Socket ID:",
      socket.id
    );

    const token =
      socket.handshake.auth?.token as
        | string
        | undefined;

    console.log(
      "[Socket] Token present:",
      Boolean(token)
    );

    /*
     * Missing token.
     */
    if (!token) {
      console.error(
        "[Socket] Authentication failed: token missing"
      );

      return next(
        new Error(
          "Authentication required"
        )
      );
    }

    /*
     * Verify JWT.
     */
    try {
      const payload =
        verifyAccessToken(token);

      console.log(
        "[Socket] Authentication successful"
      );

      console.log(
        "[Socket] User ID:",
        payload.sub
      );

      socket.data.userId = payload.sub;

      next();
    } catch (error) {
      console.error(
        "[Socket] Authentication failed: invalid token"
      );

      if (error instanceof Error) {
        console.error(
          "[Socket] JWT error:",
          error.message
        );
      }

      next(
        new Error("Invalid token")
      );
    }
  });

  /*
   * --------------------------------------------------
   * SOCKET CONNECTION
   * --------------------------------------------------
   */
  io.on(
    "connection",
    (socket: Socket) => {
      const userId =
        socket.data.userId as string;

      console.log(
        "========================================"
      );

      console.log(
        "[Socket] CONNECTED"
      );

      console.log(
        "[Socket] Socket ID:",
        socket.id
      );

      console.log(
        "[Socket] User ID:",
        userId
      );

      console.log(
        "[Socket] Transport:",
        socket.conn.transport.name
      );

      console.log(
        "[Socket] Remote address:",
        socket.handshake.address
      );

      console.log(
        "========================================"
      );

      /*
       * ------------------------------------------------
       * TRANSPORT UPGRADE
       * ------------------------------------------------
       */
      socket.conn.on(
        "upgrade",
        () => {
          console.log(
            "[Socket] Transport upgraded to:",
            socket.conn.transport.name
          );

          console.log(
            "[Socket] Socket ID:",
            socket.id
          );
        }
      );

      /*
       * ------------------------------------------------
       * PREDICT EVENT
       * ------------------------------------------------
       */
      socket.on(
        "predict",
        async (
          payload: PredictPayload,
          callback?: (
            response: PredictResponse
          ) => void
        ) => {
          console.log(
            "[Socket] Prediction request received"
          );

          try {
            /*
             * Validate payload.
             */
            if (
              !payload ||
              !payload.landmarks
            ) {
              console.error(
                "[Socket] Landmarks missing"
              );

              callback?.({
                success: false,
                error:
                  "Landmarks are required",
              });

              return;
            }

            /*
             * Validate landmark count.
             */
            if (
              payload.landmarks.length !==
              21
            ) {
              console.error(
                "[Socket] Invalid landmark count:",
                payload.landmarks.length
              );

              callback?.({
                success: false,
                error:
                  "Invalid landmarks. Expected 21 landmarks.",
              });

              return;
            }

            console.log(
              "[Socket] Calling translation service"
            );

            /*
             * Call AI/translation service.
             */
            const result =
              await translationService.translate(
                userId,
                {
                  landmarks:
                    payload.landmarks,

                  appendToText:
                    payload.appendToText,
                }
              );

            console.log(
              "[Socket] Translation successful"
            );

            /*
             * Send prediction event.
             */
            socket.emit(
              "prediction",
              result
            );

            /*
             * Send acknowledgement.
             */
            callback?.({
              success: true,
              data: result,
            });
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Prediction failed";

            console.error(
              "[Socket] Prediction error:",
              message
            );

            callback?.({
              success: false,
              error: message,
            });
          }
        }
      );

      /*
       * ------------------------------------------------
       * SOCKET ERROR
       * ------------------------------------------------
       */
      socket.on(
        "error",
        (error) => {
          console.error(
            "[Socket] Socket error"
          );

          console.error(
            "[Socket] Socket ID:",
            socket.id
          );

          console.error(
            "[Socket] Error:",
            error
          );
        }
      );

      /*
       * ------------------------------------------------
       * DISCONNECT
       * ------------------------------------------------
       */
      socket.on(
        "disconnect",
        (reason, details) => {
          console.log(
            "========================================"
          );

          console.log(
            "[Socket] DISCONNECTED"
          );

          console.log(
            "[Socket] Socket ID:",
            socket.id
          );

          console.log(
            "[Socket] User ID:",
            userId
          );

          console.log(
            "[Socket] Reason:",
            reason
          );

          /*
           * Don't access details.message or
           * details.description directly.
           *
           * Socket.IO types `details` as a union.
           */
          if (details) {
            console.log(
              "[Socket] Disconnect details:",
              details
            );
          }

          console.log(
            "========================================"
          );
        }
      );
    }
  );

  return io;
}