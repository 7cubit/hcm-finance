import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding HCMJ Finance database...\n');

  // ============================================
  // 1. Create Initial Funds
  // ============================================
  console.log('Creating Funds...');
  
  const generalFund = await prisma.fund.upsert({
    where: { name: 'General Fund' },
    update: {},
    create: {
      name: 'General Fund',
      description: 'Unrestricted funds for general church operations',
      isRestricted: false,
      color: '#6366f1',
    },
  });

  const buildingFund = await prisma.fund.upsert({
    where: { name: 'Building Fund' },
    update: {},
    create: {
      name: 'Building Fund',
      description: 'Restricted funds for construction and maintenance',
      isRestricted: true,
      color: '#f59e0b',
    },
  });

  const missionsFund = await prisma.fund.upsert({
    where: { name: 'Missions Fund' },
    update: {},
    create: {
      name: 'Missions Fund',
      description: 'Restricted funds for missionary support and outreach',
      isRestricted: true,
      color: '#10b981',
    },
  });

  await prisma.fund.upsert({
    where: { name: 'Benevolence Fund' },
    update: {},
    create: {
      name: 'Benevolence Fund',
      description: 'Restricted funds for helping those in need',
      isRestricted: true,
      color: '#ec4899',
    },
  });

  console.log(`  ✓ Created ${await prisma.fund.count()} funds`);

  // ============================================
  // 2. Create Initial Accounts
  // ============================================
  console.log('Creating Accounts...');

  await prisma.account.upsert({
    where: { name: 'Main Bank Account' },
    update: {},
    create: {
      name: 'Main Bank Account',
      type: 'BANK',
      bankName: 'MUFG Bank',
      accountNumber: '****1234',
      balance: 0,
      currency: 'JPY',
    },
  });

  await prisma.account.upsert({
    where: { name: 'Petty Cash' },
    update: {},
    create: {
      name: 'Petty Cash',
      type: 'CASH',
      balance: 0,
      currency: 'JPY',
    },
  });

  await prisma.account.upsert({
    where: { name: 'Online Giving' },
    update: {},
    create: {
      name: 'Online Giving',
      type: 'ONLINE',
      balance: 0,
      currency: 'JPY',
    },
  });

  console.log(`  ✓ Created ${await prisma.account.count()} accounts`);

  // ============================================
  // 3. Create Super Admin User with Argon2 hash
  // ============================================
  console.log('Creating Super Admin User...');

  // Hash password with Argon2
  const adminPassword = 'Admin@123!';  // Change this in production!
  const hashedPassword = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hcmj.church' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@hcmj.church',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`  ✓ Created admin user: ${adminUser.email}`);
  console.log(`  📧 Email: admin@hcmj.church`);
  console.log(`  🔑 Password: Admin@123! (CHANGE IN PRODUCTION!)`);

  // ============================================
  // 4. Create Sample Budgets
  // ============================================
  console.log('Creating Budgets...');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  await prisma.budget.upsert({
    where: {
      fundId_month_year: {
        fundId: generalFund.id,
        month: currentMonth,
        year: currentYear,
      },
    },
    update: {},
    create: {
      fundId: generalFund.id,
      month: currentMonth,
      year: currentYear,
      amount: 500000,
    },
  });

  await prisma.budget.upsert({
    where: {
      fundId_month_year: {
        fundId: missionsFund.id,
        month: currentMonth,
        year: currentYear,
      },
    },
    update: {},
    create: {
      fundId: missionsFund.id,
      month: currentMonth,
      year: currentYear,
      amount: 100000,
    },
  });

  console.log(`  ✓ Created ${await prisma.budget.count()} budgets`);

  // ============================================
  // Summary
  // ============================================
  console.log('\n✅ Seed completed successfully!\n');
  console.log('Database now contains:');
  console.log(`  • ${await prisma.fund.count()} Funds`);
  console.log(`  • ${await prisma.account.count()} Accounts`);
  console.log(`  • ${await prisma.user.count()} Users`);
  console.log(`  • ${await prisma.budget.count()} Budgets`);
  console.log('\n🔒 Super Admin Credentials:');
  console.log('   Email: admin@hcmj.church');
  console.log('   Password: Admin@123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
