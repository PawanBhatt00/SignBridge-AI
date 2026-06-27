import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp";

vi.mock("../src/services/AIService", () => ({
  aiService: {
    healthCheck: vi.fn().mockResolvedValue(true),
    predictFromLandmarks: vi.fn(),
    predictFromImage: vi.fn(),
  },
}));

describe("Health endpoint", () => {
  it("returns ok status", async () => {
    const app = createTestApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
  });
});
