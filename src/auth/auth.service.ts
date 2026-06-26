import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User as AuthenticatedUser } from './interface/user.interface';
import { User } from '../users/models/user.model';
import { MailerService } from 'src/mailer/mailer.service';
import { SignupRequestsRepository } from './signup-requests.repository';
import { RegisterInput } from './dto/inputs/register.input';
import { ConfirmRegisterInput } from './dto/inputs/confirm-register.input';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly signUpRequestRepository: SignupRequestsRepository,
  ) {}

  // This is to be depricated at a later date as we will be using the verify mail version
  async signUp(email: string, password: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, bcrypt.genSaltSync());
    return this.usersService.create({ email, passwordHash });
  }

  async register(input: RegisterInput): Promise<{ message: string }> {
    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingRequest = await this.signUpRequestRepository.findByEmail(input.email);
    const hasExpired = existingRequest && existingRequest.expiresAt < new Date();

    if (existingRequest && !hasExpired) {
      throw new ConflictException('Email already registered');
    }

    if (hasExpired) {
      await this.signUpRequestRepository.deleteById(existingRequest.id);
    }

    const passwordHash = await bcrypt.hash(input.password, bcrypt.genSaltSync());
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.signUpRequestRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
      token,
      expiresAt,
    });

    const pageUrl = this.configService.get<string>('PAGE_URL') || 'http://localhost:3000';
    const confirmLink = `${pageUrl}/confirm-register?email=${encodeURIComponent(
      input.email,
    )}&token=${encodeURIComponent(token)}`;

    await this.mailerService.sendEmail(
      {
        recipients: [{ address: input.email }],
        subject: 'Confirm your account registration',
      },
      {
        template: 'confirm-register',
        context: { confirmLink, name: input.name },
      },
    );

    return { message: 'Confirmation email sent!' };
  }

  async confirmRegister(input: ConfirmRegisterInput): Promise<User> {
    const request = await this.signUpRequestRepository.findByToken(input.token);
    if (!request || request.email !== input.email) {
      throw new BadRequestException('Invalid or expired token');
    }
    if (request.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    const user = await this.usersRepository.create({
      email: request.email,
      passwordHash: request.passwordHash,
      name: request.name,
    });

    await this.signUpRequestRepository.deleteById(request.id);

    return user;
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: AuthenticatedUser) {
    const payload = { email: user.email, sub: user.userId };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
