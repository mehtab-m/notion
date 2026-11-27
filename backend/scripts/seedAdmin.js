/**
 * Creates (or updates) the admin account from backend/.env:
 *   ADMIN_EMAILS=you@gmail.com        (first email is used)
 *   ADMIN_PASSWORD=your-password
 *   ADMIN_NAME=Admin                  (optional)
 *
 * Run:  npm run seed:admin
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  if (!email) throw new Error('ADMIN_EMAILS is empty in backend/.env');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const hashed = await bcrypt.hash(password, 10);
  const admin = {
    password: hashed,
    role: 'admin',
    isVerified: true,
    verificationCode: null,
    verificationExpires: null,
    isActive: true,
    isDeveloper: true,
  };

  const user = await prisma.user.upsert({
    where: { email },
    update: admin,
    create: {
      ...admin,
      name,
      email,
      plan: 'common',
      planExpiresAt: null,
      loginCount: 0,
      legalSettings: {},
    },
  });

  console.log(`Admin ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error('Admin seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
