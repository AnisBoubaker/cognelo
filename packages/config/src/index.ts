import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000")
});

export function getServerEnv() {
  return EnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000"
  });
}
