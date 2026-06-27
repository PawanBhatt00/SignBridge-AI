import mongoose from "mongoose";
import { AnalyticsEvent } from "../models/AnalyticsEvent";

export class AnalyticsRepository {
  async track(
    userId: string,
    eventType: "translation" | "login" | "dataset_upload" | "session_start",
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await AnalyticsEvent.create({ userId, eventType, metadata });
  }

  async countByType(userId: string): Promise<Record<string, number>> {
    const results = await AnalyticsEvent.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
    ]);
    return results.reduce(
      (acc, r) => {
        acc[r._id] = r.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

export const analyticsRepository = new AnalyticsRepository();
