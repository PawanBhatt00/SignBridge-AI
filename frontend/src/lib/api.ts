const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.message ?? "Request failed",
      data.error?.code
    );
  }

  return data.data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    request<import("@/types").AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<import("@/types").AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: () =>
    request<{ accessToken: string }>("/auth/refresh", { method: "POST" }),

  getProfile: (token: string) =>
    request<import("@/types").User & { createdAt: string }>("/auth/profile", {}, token),

  updateProfile: (token: string, body: { name?: string; avatar?: string }) =>
    request<import("@/types").User>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  logout: (token: string) =>
    request<{ message: string }>("/auth/logout", { method: "POST" }, token),

  predict: (token: string, landmarks: import("@/types").Landmark[]) =>
    request<import("@/types").PredictionResult>("/predict", {
      method: "POST",
      body: JSON.stringify({ landmarks }),
    }, token),

  translate: (
    token: string,
    body: {
      landmarks?: import("@/types").Landmark[];
      image?: string;
      appendToText?: string;
    }
  ) =>
    request<import("@/types").PredictionResult>("/translate", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getHistory: (token: string, page = 1, limit = 20) =>
    request<import("@/types").PaginatedResponse<import("@/types").Translation>>(
      `/history?page=${page}&limit=${limit}`,
      {},
      token
    ),

  getAnalytics: (token: string) =>
    request<import("@/types").Analytics>("/analytics", {}, token),

  uploadDataset: (
    token: string,
    body: { label: string; landmarks: import("@/types").Landmark[] }
  ) =>
    request<unknown>("/dataset/upload", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getDatasetStats: (token: string) =>
    request<import("@/types").DatasetStats>("/dataset/statistics", {}, token),
};
