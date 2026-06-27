import { Router } from "express";
import { translationController } from "../controllers/TranslationController";
import { authenticate } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { paginationSchema, predictSchema, translateSchema } from "../validators";

const router = Router();

router.use(authenticate);

router.post("/predict", validateBody(predictSchema), (req, res, next) => {
  translationController.predict(req, res).catch(next);
});

router.post("/translate", validateBody(translateSchema), (req, res, next) => {
  translationController.translate(req, res).catch(next);
});

router.get("/history", validateQuery(paginationSchema), (req, res, next) => {
  translationController.history(req, res).catch(next);
});

router.get("/analytics", (req, res, next) => {
  translationController.analytics(req, res).catch(next);
});

export default router;
