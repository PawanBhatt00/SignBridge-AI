import { Response } from "express";
import { translationService } from "../services/TranslationService";
import { AuthenticatedRequest } from "../types";

export class TranslationController {
  async predict(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await translationService.predict(req.user!.id, req.body.landmarks);
    res.json({ success: true, data: result });
  }

  async translate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await translationService.translate(req.user!.id, {
      landmarks: req.body.landmarks,
      image: req.body.image,
      appendToText: req.body.appendToText,
    });
    res.json({ success: true, data: result });
  }

  async history(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await translationService.getHistory(req.user!.id, page, limit);
    res.json({ success: true, data: result });
  }

  async analytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const analytics = await translationService.getAnalytics(req.user!.id);
    res.json({ success: true, data: analytics });
  }
}

export const translationController = new TranslationController();
