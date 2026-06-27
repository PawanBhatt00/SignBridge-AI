import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const translateSchema = z
  .object({
    image: z.string().min(1).optional(),
    landmarks: z
      .array(
        z.object({
          x: z.number(),
          y: z.number(),
          z: z.number().optional().default(0),
        })
      )
      .length(21)
      .optional(),
    appendToText: z.string().optional().default(""),
  })
  .refine((data) => Boolean(data.image) || Boolean(data.landmarks), {
    message: "Either image or landmarks is required",
    path: ["landmarks"],
  });

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().or(z.literal("")),
});

export const predictSchema = z.object({
  landmarks: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        z: z.number().optional().default(0),
      })
    )
    .length(21),
});

export const datasetUploadSchema = z.object({
  label: z.string().min(1).max(10).transform((v) => v.toUpperCase()),
  landmarks: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        z: z.number().optional().default(0),
      })
    )
    .length(21),
  imageUrl: z.string().url().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TranslateInput = z.infer<typeof translateSchema>;
export type PredictInput = z.infer<typeof predictSchema>;
export type DatasetUploadInput = z.infer<typeof datasetUploadSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
