import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SignupRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.signup_requests.findUnique({
      where: { email },
    });
  }

  findByToken(token: string) {
    return this.prisma.signup_requests.findUnique({
      where: { token },
    });
  }

  create(data: {
    email: string;
    name: string;
    password_hash: string;
    token: string;
    expires_at: Date;
  }) {
    return this.prisma.signup_requests.create({ data });
  }

  deleteById(id: string) {
    this.prisma.signup_requests.delete({
      where: { id },
    });
  }
}
