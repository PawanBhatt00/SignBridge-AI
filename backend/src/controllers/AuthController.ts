import { Response } from "express";
import { config } from "../config";
import { authService } from "../services/AuthService";
import { AuthenticatedRequest } from "../types";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: "lax" as const,
  path: "/",
};

export class AuthController {
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await authService.register(req.body);
    res.cookie("refreshToken", result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    res.cookie("refreshToken", result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  async refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
    const token = req.cookies?.refreshToken ?? req.body.refreshToken;
    if (!token) {
      res.status(401).json({
        success: false,
        error: { message: "Refresh token required", code: "UNAUTHORIZED" },
      });
      return;
    }
    const result = await authService.refresh(token);
    res.cookie("refreshToken", result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  }

  async profile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const profile = await authService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const profile = await authService.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: profile });
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    await authService.logout(req.user!.id);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    res.json({ success: true, data: { message: "Logged out successfully" } });
  }
}

export const authController = new AuthController();
