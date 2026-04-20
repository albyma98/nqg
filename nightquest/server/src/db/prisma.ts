import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { normalizeDatabaseUrl } from './database-url.js';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL, import.meta.url);
}

export const prisma = new PrismaClient();
