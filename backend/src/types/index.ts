import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface TokenPayload extends JwtPayload {
  sub: string;
  email: string;
  name: string;
  type: "access" | "refresh";
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface PredictResponse {
  prediction: string;
  confidence: number;
}

export interface AnalyticsSummary {
  totalTranslations: number;
  averageConfidence: number;
  topPredictions: Array<{ label: string; count: number }>;
  translationsToday: number;
  translationsThisWeek: number;
  accuracyRate: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
