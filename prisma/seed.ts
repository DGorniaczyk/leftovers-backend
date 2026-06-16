import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

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
  for (const user of userData) {
    const createdUser = await prisma.users.create({
      data: user,
    });
    console.log(`Created user with id: ${createdUser.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
