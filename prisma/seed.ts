import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const userData: Prisma.usersCreateInput[] = [
  {
    email: 'alice@example.com',
    name: 'Alice',
    password: 'password123',
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
    password: 'password456',
  },
  {
    email: 'carol@example.com',
    name: 'Carol',
    password: 'password789',
  },
];

export async function main() {
  const result = await prisma.users.createMany({
    data: userData,
    skipDuplicates: true,
  });

  console.log(`Created ${result.count} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
