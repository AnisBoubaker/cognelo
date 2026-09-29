import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  MEDIA_STORAGE_ROOT: z.string().min(1).optional(),
  EMAIL_CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[A-Fa-f0-9]{64}$/, "EMAIL_CREDENTIALS_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.")
    .optional()
});

export function getServerEnv() {
  return EnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    API_PUBLIC_URL: process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    MEDIA_STORAGE_ROOT: process.env.MEDIA_STORAGE_ROOT?.trim() || undefined,
    EMAIL_CREDENTIALS_ENCRYPTION_KEY: process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY || undefined
  });
}
