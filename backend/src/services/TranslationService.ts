import { analyticsRepository } from "../repositories/AnalyticsRepository";
import { translationRepository } from "../repositories/TranslationRepository";
import { AnalyticsSummary, Landmark } from "../types";
import { ValidationError } from "../utils/errors";
import { aiService } from "./AIService";

export class TranslationService {
  async predict(userId: string, landmarks: Landmark[]): Promise<{
    prediction: string;
    confidence: number;
  }> {
    const result = await aiService.predictFromLandmarks(landmarks);
    if (result.prediction) {
      await analyticsRepository.track(userId, "translation", {
        prediction: result.prediction,
        confidence: result.confidence,
      });
    }
    return result;
  }

  async translate(
    userId: string,
    options: {
      landmarks?: Landmark[];
      image?: string;
      appendToText?: string;
    }
  ): Promise<{
    prediction: string;
    confidence: number;
    fullText: string;
    translationId: string;
    landmarks?: Landmark[];
  }> {
    let result: { prediction: string; confidence: number; landmarks?: Landmark[] };

    if (options.image) {
      result = await aiService.predictFromImage(options.image);
    } else if (options.landmarks) {
      result = await aiService.predictFromLandmarks(options.landmarks);
    } else {
      throw new ValidationError("Either landmarks or image is required");
    }

    const appendText = options.appendToText ?? "";
    const fullText =
      result.prediction && appendText
        ? `${appendText}${result.prediction}`
        : result.prediction
          ? result.prediction
          : appendText;

    const translation = await translationRepository.create({
      userId,
      prediction: result.prediction,
      confidence: result.confidence,
      fullText,
      landmarks: result.landmarks ?? options.landmarks,
    });

    await analyticsRepository.track(userId, "translation", {
      prediction: result.prediction,
      confidence: result.confidence,
      translationId: translation._id.toString(),
    });

    return {
      prediction: result.prediction,
      confidence: result.confidence,
      fullText,
      translationId: translation._id.toString(),
      landmarks: result.landmarks ?? options.landmarks,
    };
  }

  async getHistory(userId: string, page: number, limit: number) {
    return translationRepository.findByUser(userId, page, limit);
  }

  async getAnalytics(userId: string): Promise<AnalyticsSummary> {
    const stats = await translationRepository.getStats(userId);
    const avgConfidencePct =
      stats.total > 0 ? Math.round(stats.avgConfidence * 10000) / 100 : 0;

    return {
      totalTranslations: stats.total,
      averageConfidence: Math.round(stats.avgConfidence * 10000) / 10000,
      topPredictions: stats.topPredictions,
      translationsToday: stats.today,
      translationsThisWeek: stats.thisWeek,
      accuracyRate: avgConfidencePct,
    };
  }
}

export const translationService = new TranslationService();
