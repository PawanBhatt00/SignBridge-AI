import { describe, expect, it } from "vitest";
import { hashPassword, comparePassword } from "../src/utils/password";
import { registerSchema, loginSchema } from "../src/validators";

describe("Password utilities", () => {
  it("hashes and verifies password", async () => {
    const password = "TestPass123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
    expect(await comparePassword("wrong", hash)).toBe(false);
  });
});

describe("Validation schemas", () => {
  it("validates register input", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects weak password", () => {
    const result = registerSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("validates login input", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "any",
    });
    expect(result.success).toBe(true);
  });
});
