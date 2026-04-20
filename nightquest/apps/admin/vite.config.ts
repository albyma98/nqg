import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pfxPath = env.VITE_DEV_PFX_PATH ? path.resolve(process.cwd(), env.VITE_DEV_PFX_PATH) : null;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5174,
      https:
        env.VITE_DEV_HTTPS === 'true' && pfxPath && fs.existsSync(pfxPath)
          ? {
              pfx: fs.readFileSync(pfxPath),
              passphrase: env.VITE_DEV_PFX_PASSPHRASE
            }
          : undefined
    }
  };
});
