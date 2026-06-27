import dotenv from "dotenv";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { DatasetSample } from "../models/DatasetSample";
import { Translation } from "../models/Translation";
import { User } from "../models/User";
import { hashPassword } from "../utils/password";

dotenv.config();

const DEMO_USER = {
  name: "Pawan Bhatt",
  email: "pawank88252@gmail.com",
  password: "SignBridge1",
};

function generateLandmarks(seed: number): Array<{ x: number; y: number; z: number }> {
  const landmarks: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({
      x: 0.5 + Math.sin(seed + i) * 0.1,
      y: 0.5 + Math.cos(seed + i) * 0.1,
      z: 0,
    });
  }
  return landmarks;
}

async function seed(): Promise<void> {
  await connectDatabase();

  console.log("Seeding database...");

  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) {
    const hashed = await hashPassword(DEMO_USER.password);
    user = await User.create({
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      password: hashed,
    });
    console.log(`Created demo user: ${DEMO_USER.email}`);
  } else {
    console.log(`Demo user already exists: ${DEMO_USER.email}`);
  }

  const userId = user._id;

  const existingTranslations = await Translation.countDocuments({ userId });
  if (existingTranslations === 0) {
    const letters = "ABCDEFGHI";
    for (let i = 0; i < letters.length; i++) {
      await Translation.create({
        userId,
        prediction: letters[i],
        confidence: 0.85 + Math.random() * 0.14,
        fullText: letters.slice(0, i + 1),
        landmarks: generateLandmarks(i),
      });
    }
    console.log("Created sample translations");
  }

  const existingSamples = await DatasetSample.countDocuments({ userId });
  if (existingSamples === 0) {
    const labels = ["A", "B", "C", "D", "E"];
    for (const label of labels) {
      for (let j = 0; j < 5; j++) {
        await DatasetSample.create({
          userId,
          label,
          landmarks: generateLandmarks(label.charCodeAt(0) + j),
        });
      }
    }
    console.log("Created sample dataset entries");
  }

  console.log("Seed complete!");
  await disconnectDatabase();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
