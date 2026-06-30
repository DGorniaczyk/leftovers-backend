import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { User, CreateUser } from './models/user.model';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    const rows = await this.prisma.users.findMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.users.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: CreateUser): Promise<User> {
    try {
      const row = await this.prisma.users.create({
        data: {
          email: input.email,
          password: input.passwordHash,
          name: input.name,
        },
      });
      return this.toDomain(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  private toDomain(
    row: NonNullable<Awaited<ReturnType<typeof this.prisma.users.findUnique>>>,
  ): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password,
    };
  }
}
