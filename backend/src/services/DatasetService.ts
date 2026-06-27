import { analyticsRepository } from "../repositories/AnalyticsRepository";
import { datasetRepository } from "../repositories/DatasetRepository";
import { DatasetUploadInput } from "../validators";

export class DatasetService {
  async upload(userId: string, input: DatasetUploadInput) {
    const sample = await datasetRepository.create({
      userId,
      label: input.label,
      landmarks: input.landmarks.map((l) => ({
        x: l.x,
        y: l.y,
        z: l.z ?? 0,
      })),
      imageUrl: input.imageUrl,
    });

    await analyticsRepository.track(userId, "dataset_upload", {
      label: input.label,
      sampleId: sample._id.toString(),
    });

    return sample;
  }

  async getSamples(userId: string) {
    return datasetRepository.findByUser(userId);
  }

  async getStatistics(userId?: string) {
    return datasetRepository.getStatistics(userId);
  }

  async exportTrainingData() {
    return datasetRepository.exportForTraining();
  }
}

export const datasetService = new DatasetService();
