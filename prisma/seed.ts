import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const userData: Array<Prisma.usersCreateInput> = [
  {
    email: 'alice@example.com',
    name: 'Alice',
    password: 'password123',
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
    password: 'password123',
  },
  {
    email: 'carol@example.com',
    name: 'Carol',
    password: 'password123',
  },
];

export async function main() {
  let createdCount = 0;

  for (const user of userData) {
    const hashedPassword = await bcrypt.hash(user.password ?? '', 10);

    try {
      await prisma.users.create({
        data: {
          email: user.email,
          name: user.name,
          password: hashedPassword,
        },
      });
      createdCount += 1;
      console.log(`Created user ${user.email}`);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        console.log(`Skipping duplicate user ${user.email}`);
        continue;
      }
      throw error;
    }
  }

  console.log(`Created ${createdCount} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
