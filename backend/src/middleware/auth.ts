import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types";
import { UnauthorizedError } from "../utils/errors";
import { toAuthUser, verifyAccessToken } from "../utils/jwt";

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (!token) {
      throw new UnauthorizedError("Access token required");
    }

    const payload = verifyAccessToken(token);
    req.user = toAuthUser(payload);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (token) {
      const payload = verifyAccessToken(token);
      req.user = toAuthUser(payload);
    }
    next();
  } catch {
    next();
  }
}
