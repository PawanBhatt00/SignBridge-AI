import mongoose from "mongoose";
import { DatasetSample, IDatasetSample } from "../models/DatasetSample";

export class DatasetRepository {
  async create(data: {
    userId: string;
    label: string;
    landmarks: Array<{ x: number; y: number; z: number }>;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<IDatasetSample> {
    const sample = new DatasetSample(data);
    return sample.save();
  }

  async findByUser(userId: string): Promise<IDatasetSample[]> {
    return DatasetSample.find({ userId }).sort({ createdAt: -1 });
  }

  async getStatistics(userId?: string): Promise<{
    totalSamples: number;
    labelCounts: Array<{ label: string; count: number }>;
    uniqueLabels: number;
  }> {
    const match = userId
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};

    const [totalSamples, labelCounts] = await Promise.all([
      DatasetSample.countDocuments(match),
      DatasetSample.aggregate([
        { $match: match },
        { $group: { _id: "$label", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      totalSamples,
      labelCounts: labelCounts.map((l) => ({ label: l._id, count: l.count })),
      uniqueLabels: labelCounts.length,
    };
  }

  async exportForTraining(): Promise<
    Array<{ label: string; landmarks: Array<{ x: number; y: number; z: number }> }>
  > {
    const samples = await DatasetSample.find().select("label landmarks");
    return samples.map((s) => ({
      label: s.label,
      landmarks: s.landmarks,
    }));
  }
}

export const datasetRepository = new DatasetRepository();
