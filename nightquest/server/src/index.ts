import express, { type RequestHandler } from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoHttpImport from 'pino-http';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { config } from './config.js';
import { prisma } from './db/prisma.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { adminRouter } from './routes/admin.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { ensureBootstrapAdmin } from './services/auth.service.js';

const app = express();
const logger = pino({ name: 'nightquest-server' });
const pinoHttp = pinoHttpImport as unknown as (options: { logger: typeof logger }) => RequestHandler;

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(publicRouter);
app.use('/api/admin', adminRouter);
app.use(errorMiddleware);

async function start() {
  await prisma.$connect();
  await ensureBootstrapAdmin();

  if (config.HTTPS_ENABLED && config.HTTPS_PFX_PATH) {
    const pfxPath = path.resolve(process.cwd(), config.HTTPS_PFX_PATH);
    https
      .createServer(
        {
          pfx: fs.readFileSync(pfxPath),
          passphrase: config.HTTPS_PFX_PASSPHRASE
        },
        app
      )
      .listen(config.PORT, '0.0.0.0', () => {
        logger.info({ port: config.PORT, https: true, pfxPath }, 'server avviato');
      });
    return;
  }

  app.listen(config.PORT, '0.0.0.0', () => {
    logger.info({ port: config.PORT, https: false }, 'server avviato');
  });
}

start().catch((error) => {
  logger.error(error);
  process.exit(1);
});
