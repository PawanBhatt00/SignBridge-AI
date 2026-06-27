import { Response } from "express";
import { datasetService } from "../services/DatasetService";
import { AuthenticatedRequest } from "../types";

export class DatasetController {
  async upload(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sample = await datasetService.upload(req.user!.id, req.body);
    res.status(201).json({ success: true, data: sample });
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const samples = await datasetService.getSamples(req.user!.id);
    res.json({ success: true, data: samples });
  }

  async statistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await datasetService.getStatistics(req.user!.id);
    res.json({ success: true, data: stats });
  }

  async export(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await datasetService.exportTrainingData();
    res.json({ success: true, data });
  }
}

export const datasetController = new DatasetController();
