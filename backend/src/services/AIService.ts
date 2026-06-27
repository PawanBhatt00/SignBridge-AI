import axios, { AxiosError } from "axios";
import { config } from "../config";
import { Landmark, PredictResponse } from "../types";
import { AppError } from "../utils/errors";

const aiClient = axios.create({
  baseURL: config.aiServiceUrl,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export class AIService {
  async predictFromLandmarks(landmarks: Landmark[]): Promise<PredictResponse> {
    try {
      const response = await aiClient.post<PredictResponse>("/predict", {
        landmarks: landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z ?? 0 })),
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new AppError(
          error.response?.status ?? 502,
          error.response?.data?.detail ?? "AI service unavailable",
          "AI_SERVICE_ERROR"
        );
      }
      throw error;
    }
  }

  async predictFromImage(imageBase64: string): Promise<PredictResponse & { landmarks?: Landmark[] }> {
    try {
      const response = await aiClient.post<PredictResponse & { landmarks?: Landmark[] }>(
        "/predict/base64",
        { image: imageBase64 }
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new AppError(
          error.response?.status ?? 502,
          error.response?.data?.detail ?? "AI service unavailable",
          "AI_SERVICE_ERROR"
        );
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await aiClient.get("/health");
      return response.data?.status === "ok";
    } catch {
      return false;
    }
  }
}

export const aiService = new AIService();
