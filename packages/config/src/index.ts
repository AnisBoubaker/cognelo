import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  JUDGE0_BASE_URL: z.string().url().default("http://localhost:2358"),
  JUDGE0_AUTH_HEADER: z.string().min(1).default("X-Auth-Token"),
  JUDGE0_AUTH_TOKEN: z.string().min(1).default("dev-local-token"),
  JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS: z.coerce.boolean().default(true),
  WEB_DESIGN_RUNNER_URL: z.string().url().default("http://localhost:3456")
});

export function getServerEnv() {
  return EnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    JUDGE0_BASE_URL: process.env.JUDGE0_BASE_URL ?? "http://localhost:2358",
    JUDGE0_AUTH_HEADER: process.env.JUDGE0_AUTH_HEADER ?? "X-Auth-Token",
    JUDGE0_AUTH_TOKEN: process.env.JUDGE0_AUTH_TOKEN ?? "dev-local-token",
    JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS: process.env.JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS ?? "true",
    WEB_DESIGN_RUNNER_URL: process.env.WEB_DESIGN_RUNNER_URL ?? "http://localhost:3456"
  });
}
