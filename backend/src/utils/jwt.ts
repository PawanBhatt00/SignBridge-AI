import jwt from "jsonwebtoken";
import { config } from "../config";
import { AuthUser, TokenPayload } from "../types";

export function signAccessToken(user: AuthUser): string {
  const payload: Omit<TokenPayload, "iat" | "exp"> = {
    sub: user.id,
    email: user.email,
    name: user.name,
    type: "access",
  };
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(user: AuthUser): string {
  const payload: Omit<TokenPayload, "iat" | "exp"> = {
    sub: user.id,
    email: user.email,
    name: user.name,
    type: "refresh",
  };
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return payload;
}

export function toAuthUser(payload: TokenPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
