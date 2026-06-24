import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from './interface/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // This is to be depricated at a later date as we will be using the verify mail version
  async signUp(email: string, password: string) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
    return this.usersService.create(email, hashedPassword);
  }

  async register(email: string, password: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists!');
    }

    const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
  }

  async validateUser(email: string, password: string) {
    // Check if credentials are valid
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.userId };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
