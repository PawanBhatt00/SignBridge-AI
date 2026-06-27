import { config } from "../config";
import { analyticsRepository } from "../repositories/AnalyticsRepository";
import { userRepository } from "../repositories/UserRepository";
import { AuthUser } from "../types";
import { ConflictError, UnauthorizedError } from "../utils/errors";
import {
  signAccessToken,
  signRefreshToken,
  toAuthUser,
  verifyRefreshToken,
} from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";
import { LoginInput, RegisterInput } from "../validators";

export class AuthService {
  async register(input: RegisterInput): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const exists = await userRepository.emailExists(input.email);
    if (exists) {
      throw new ConflictError("Email already registered");
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });

    const authUser: AuthUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };

    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);
    await userRepository.updateRefreshToken(authUser.id, refreshToken);

    return { user: authUser, accessToken, refreshToken };
  }

  async login(input: LoginInput): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const authUser: AuthUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };

    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);
    await userRepository.updateRefreshToken(authUser.id, refreshToken);
    await analyticsRepository.track(authUser.id, "login");

    return { user: authUser, accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyRefreshToken(refreshToken);
    const user = await userRepository.findById(payload.sub);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const authUser = toAuthUser(payload);
    const newAccessToken = signAccessToken(authUser);
    const newRefreshToken = signRefreshToken(authUser);
    await userRepository.updateRefreshToken(authUser.id, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
    createdAt: Date;
  }> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string; avatar?: string }
  ): Promise<{ id: string; name: string; email: string; avatar?: string }> {
    const user = await userRepository.updateProfile(userId, data);
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };
  }

  async logout(userId: string): Promise<void> {
    await userRepository.updateRefreshToken(userId, null);
  }
}

export const authService = new AuthService();
