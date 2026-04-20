import { fileURLToPath } from 'node:url';
import path from 'node:path';

function findServerRoot(fromModuleUrl: string) {
  const modulePath = fileURLToPath(fromModuleUrl);
  const normalized = path.normalize(modulePath);
  const parts = normalized.split(path.sep);
  const serverIndex = parts.lastIndexOf('server');

  if (serverIndex === -1) {
    return path.dirname(modulePath);
  }

  return parts.slice(0, serverIndex + 1).join(path.sep);
}

function resolveSqliteUrl(rawUrl: string, serverRoot: string) {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const target = rawUrl.slice(5);
  if (!target || path.isAbsolute(target)) {
    return rawUrl;
  }

  const absolutePath = path.resolve(serverRoot, target).replace(/\\/g, '/');
  return `file:${absolutePath}`;
}

export function normalizeDatabaseUrl(rawUrl: string, fromModuleUrl: string) {
  const serverRoot = findServerRoot(fromModuleUrl);
  return resolveSqliteUrl(rawUrl, serverRoot);
}
