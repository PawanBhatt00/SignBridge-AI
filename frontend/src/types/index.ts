export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  fullText?: string;
  translationId?: string;
  landmarks?: Landmark[];
}

export interface Translation {
  _id: string;
  prediction: string;
  confidence: number;
  fullText: string;
  createdAt: string;
}

export interface Analytics {
  totalTranslations: number;
  averageConfidence: number;
  topPredictions: Array<{ label: string; count: number }>;
  translationsToday: number;
  translationsThisWeek: number;
  accuracyRate: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message: string; code?: string };
}

export interface DatasetStats {
  totalSamples: number;
  labelCounts: Array<{ label: string; count: number }>;
  uniqueLabels: number;
}
