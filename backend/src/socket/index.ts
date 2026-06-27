import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "../config";
import { translationService } from "../services/TranslationService";
import { Landmark, TokenPayload } from "../types";
import { verifyAccessToken } from "../utils/jwt";

interface PredictPayload {
  landmarks: Landmark[];
  appendToText?: string;
}

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`Socket connected: ${userId}`);

    socket.on("predict", async (payload: PredictPayload, callback) => {
      try {
        if (!payload.landmarks || payload.landmarks.length !== 21) {
          callback?.({ success: false, error: "Invalid landmarks" });
          return;
        }

        const result = await translationService.translate(userId, {
          landmarks: payload.landmarks,
          appendToText: payload.appendToText,
        });

        socket.emit("prediction", result);
        callback?.({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Prediction failed";
        callback?.({ success: false, error: message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${userId}`);
    });
  });

  return io;
}
