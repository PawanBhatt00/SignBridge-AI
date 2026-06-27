import dotenv from "dotenv";
dotenv.config();
console.log("JWT secret loaded:", !!config.jwt?.accessSecret);
// should print: JWT secret loaded: true
// if it prints false, share your config.ts next
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import morgan from "morgan";
import { config } from "./config";
import { connectDatabase } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";
import { setupSocketIO } from "./socket";

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(morgan(config.nodeEnv === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

setupSocketIO(httpServer);

async function start(): Promise<void> {
  await connectDatabase();
  httpServer.listen(config.port, () => {
    console.log(`SignBridge API running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export { app, httpServer };
