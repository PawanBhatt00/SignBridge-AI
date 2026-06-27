import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "../config";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(config.mongodbUri);
    console.log("Connected to MongoDB");
    return;
  } catch (error) {
    if (config.nodeEnv !== "development") {
      throw error;
    }
    console.warn("MongoDB unavailable, starting in-memory database for development");
  }

  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory MongoDB (development)");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  console.log("Disconnected from MongoDB");
}
