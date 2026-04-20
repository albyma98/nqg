import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(8),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default('admin@nightquest.it'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(1),
  ADMIN_AUTH_DISABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  PORT: z.coerce.number().default(3001),
  HTTPS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  HTTPS_PFX_PATH: z.string().optional(),
  HTTPS_PFX_PASSPHRASE: z.string().optional(),
  GENERATION_DAILY_LIMIT: z.coerce.number().default(20),
  GENERATION_CONCURRENT_LIMIT: z.coerce.number().default(5),
  GENERATION_CONFIRM_COST_THRESHOLD_USD: z.coerce.number().default(0.5)
});

export const config = schema.parse(process.env);
