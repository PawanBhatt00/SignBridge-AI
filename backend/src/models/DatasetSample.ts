import mongoose, { Document, Schema } from "mongoose";

export interface IDatasetSample extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  label: string;
  landmarks: Array<{ x: number; y: number; z: number }>;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const datasetSampleSchema = new Schema<IDatasetSample>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true, uppercase: true },
    landmarks: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        z: { type: Number, default: 0 },
      },
    ],
    imageUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

datasetSampleSchema.index({ label: 1 });
datasetSampleSchema.index({ userId: 1, label: 1 });

export const DatasetSample = mongoose.model<IDatasetSample>("DatasetSample", datasetSampleSchema);
