import mongoose, { Document, Schema } from "mongoose";

export interface ITranslation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  prediction: string;
  confidence: number;
  fullText: string;
  landmarks?: Array<{ x: number; y: number; z: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema<ITranslation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prediction: { type: String, default: "" },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    fullText: { type: String, default: "" },
    landmarks: [
      {
        x: Number,
        y: Number,
        z: Number,
      },
    ],
  },
  { timestamps: true }
);

translationSchema.index({ userId: 1, createdAt: -1 });

export const Translation = mongoose.model<ITranslation>("Translation", translationSchema);
