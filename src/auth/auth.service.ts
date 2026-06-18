import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async signUp(email: string, password: string) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    if (!email || !password) {
      throw new BadRequestException('Email/Password is invalid');
    }

    const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
    return this.usersService.create(email, hashedPassword);
  }
}
