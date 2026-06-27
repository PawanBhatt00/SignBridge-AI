import mongoose from "mongoose";
import { ITranslation, Translation } from "../models/Translation";
import { PaginatedResult } from "../types";

export class TranslationRepository {
  async create(data: {
    userId: string;
    prediction: string;
    confidence: number;
    fullText: string;
    landmarks?: Array<{ x: number; y: number; z: number }>;
  }): Promise<ITranslation> {
    const translation = new Translation({
      userId: data.userId,
      prediction: data.prediction,
      confidence: data.confidence,
      fullText: data.fullText,
      landmarks: data.landmarks,
    });
    return translation.save();
  }

  async findByUser(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<ITranslation>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Translation.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Translation.countDocuments({ userId }),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecent(userId: string, limit = 10): Promise<ITranslation[]> {
    return Translation.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  }

  async getStats(userId: string): Promise<{
    total: number;
    avgConfidence: number;
    topPredictions: Array<{ label: string; count: number }>;
    today: number;
    thisWeek: number;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [total, avgResult, topPredictions, today, thisWeek] = await Promise.all([
      Translation.countDocuments({ userId }),
      Translation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, avg: { $avg: "$confidence" } } },
      ]),
      Translation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$prediction", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Translation.countDocuments({ userId, createdAt: { $gte: startOfDay } }),
      Translation.countDocuments({ userId, createdAt: { $gte: startOfWeek } }),
    ]);

    return {
      total,
      avgConfidence: avgResult[0]?.avg ?? 0,
      topPredictions: topPredictions.map((p) => ({ label: p._id, count: p.count })),
      today,
      thisWeek,
    };
  }
}

export const translationRepository = new TranslationRepository();
