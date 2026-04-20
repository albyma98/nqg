import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';

export async function ensureBootstrapAdmin() {
  const existing = await prisma.adminUser.count();
  if (existing > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.ADMIN_BOOTSTRAP_PASSWORD, 10);

  await prisma.adminUser.create({
    data: {
      email: config.ADMIN_BOOTSTRAP_EMAIL,
      passwordHash,
      role: 'admin'
    }
  });

  console.log(`[nightquest] admin bootstrap creato: ${config.ADMIN_BOOTSTRAP_EMAIL}`);
}

export async function loginAdmin(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.JWT_SECRET, {
    expiresIn: '12h'
  });
}
