import { Router } from "express";
import { datasetController } from "../controllers/DatasetController";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { datasetUploadSchema } from "../validators";

const router = Router();

router.use(authenticate);

router.post("/upload", validateBody(datasetUploadSchema), (req, res, next) => {
  datasetController.upload(req, res).catch(next);
});

router.get("/samples", (req, res, next) => {
  datasetController.list(req, res).catch(next);
});

router.get("/statistics", (req, res, next) => {
  datasetController.statistics(req, res).catch(next);
});

router.get("/export", (req, res, next) => {
  datasetController.export(req, res).catch(next);
});

export default router;
