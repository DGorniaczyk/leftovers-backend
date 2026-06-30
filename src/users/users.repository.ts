import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.users.findMany();
  }

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
    });
  }

  async create(email: string, passwordhash: string, name?: string | null) {
    return this.prisma.users.create({
      data: {
        email,
        password: passwordhash,
        name,
      },
    });
  }
}
