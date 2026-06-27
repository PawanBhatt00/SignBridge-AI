import { Router } from "express";
import { aiService } from "../services/AIService";
import authRoutes from "./auth.routes";
import datasetRoutes from "./dataset.routes";
import translationRoutes from "./translation.routes";

const router = Router();

router.get("/health", async (_req, res) => {
  const aiHealthy = await aiService.healthCheck();
  res.json({
    success: true,
    data: {
      status: "ok",
      aiService: aiHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
  });
});

router.use("/auth", authRoutes);
router.use("/", translationRoutes);
router.use("/dataset", datasetRoutes);

export default router;
