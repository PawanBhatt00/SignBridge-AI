import mongoose, { Document, Schema } from "mongoose";

export interface IAnalyticsEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  eventType: "translation" | "login" | "dataset_upload" | "session_start";
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      enum: ["translation", "login", "dataset_upload", "session_start"],
      required: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

analyticsEventSchema.index({ userId: 1, createdAt: -1 });
analyticsEventSchema.index({ eventType: 1 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);
