import { z } from "zod";

export enum Environment {
  Development = "development",
  Production = "production",
}

const zEnv = z.object({
  ENVIRONMENT: z.enum(Environment).default(Environment.Development),
  SENTRY_DSN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  BRAVE_API_KEY: z.string().min(1),
  BRAVE_RATE_LIMIT_PER_SECOND: z.coerce.number().positive().default(1),
  BRAVE_RATE_LIMIT_PER_MONTH: z.coerce.number().int().positive().default(2000),
});

export const ENV = zEnv.parse(process.env);
