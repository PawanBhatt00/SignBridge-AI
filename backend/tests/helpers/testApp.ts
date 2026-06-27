import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import routes from "../../src/routes";
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler";

export function createTestApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use("/api", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
