import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { signup_requests as SignupRequestRow } from '../generated/prisma/client';
import { SignupRequest, CreateSignupRequest } from './models/signup-request.model';

@Injectable()
export class SignupRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<SignupRequest | null> {
    const row = await this.prisma.signup_requests.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<SignupRequest | null> {
    const row = await this.prisma.signup_requests.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: CreateSignupRequest): Promise<SignupRequest> {
    const row = await this.prisma.signup_requests.create({
      data: {
        email: input.email,
        name: input.name,
        password_hash: input.hashedPassword,
        expires_at: input.expiresAt,
      },
    });
    return this.toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.signup_requests.delete({ where: { id } });
  }

  private toDomain(row: SignupRequestRow): SignupRequest {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      hashedPassword: row.password_hash,
      expiresAt: row.expires_at,
    };
  }
}
