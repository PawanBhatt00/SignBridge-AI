import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  mongodbUri: requireEnv("MONGODB_URI", "mongodb://localhost:27017/signbridge"),
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  aiServiceUrl: requireEnv("AI_SERVICE_URL", "http://localhost:8000"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  cookieSecure: process.env.COOKIE_SECURE === "true",
} as const;
