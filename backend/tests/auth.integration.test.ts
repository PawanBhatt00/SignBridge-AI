import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/testApp";

describe("Auth API", () => {
  const app = createTestApp();

  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Integration User",
      email: "integration@test.com",
      password: "TestPass123",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("integration@test.com");
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("rejects duplicate registration", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Dup User",
      email: "dup@test.com",
      password: "TestPass123",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Dup User 2",
      email: "dup@test.com",
      password: "TestPass123",
    });

    expect(res.status).toBe(409);
  });

  it("logs in and returns tokens", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "login@test.com",
      password: "TestPass123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "login@test.com",
      password: "TestPass123",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("returns profile for authenticated user", async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Profile User",
      email: "profile@test.com",
      password: "TestPass123",
    });

    const token = register.body.data.accessToken;
    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Profile User");
  });
});
