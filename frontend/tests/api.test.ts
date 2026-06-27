import { describe, expect, it } from "vitest";

describe("SignBridge frontend", () => {
  it("has correct API URL default", () => {
    const url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    expect(url).toContain("/api");
  });
});
