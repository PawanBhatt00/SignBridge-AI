import { Router } from "express";
import { authController } from "../controllers/AuthController";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema, profileUpdateSchema, registerSchema } from "../validators";

const router = Router();

router.post("/register", validateBody(registerSchema), (req, res, next) => {
  authController.register(req, res).catch(next);
});

router.post("/login", validateBody(loginSchema), (req, res, next) => {
  authController.login(req, res).catch(next);
});

router.post("/refresh", (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

router.get("/profile", authenticate, (req, res, next) => {
  authController.profile(req, res).catch(next);
});

router.patch("/profile", authenticate, validateBody(profileUpdateSchema), (req, res, next) => {
  authController.updateProfile(req, res).catch(next);
});

router.post("/logout", authenticate, (req, res, next) => {
  authController.logout(req, res).catch(next);
});

export default router;
