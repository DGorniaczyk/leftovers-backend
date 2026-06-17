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
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
  },
  {
    email: 'carol@example.com',
    name: 'Carol',
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
