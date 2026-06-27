import { IUser, User } from "../models/User";
import { NotFoundError } from "../utils/errors";

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async create(data: { name: string; email: string; password: string }): Promise<IUser> {
    const user = new User(data);
    return user.save();
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    await User.findByIdAndUpdate(id, { refreshToken });
  }

  async updateProfile(
    id: string,
    data: Partial<Pick<IUser, "name" | "avatar">>
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(id, data, { new: true });
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await User.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }
}

export const userRepository = new UserRepository();
