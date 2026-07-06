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
import { TokenExpiredError } from 'jsonwebtoken';
import { User as AuthenticatedUser } from './interface/user.interface';
import { User } from '../users/models/user.model';
import { MailerService } from 'src/mailer/mailer.service';
import { SignupRequestsRepository } from './signup-requests.repository';
import { RegisterInput } from './dto/inputs/register-input.dto';
import { ConfirmRegisterInput } from './dto/inputs/confirm-register-input.dto';
import { ResetPasswordInput } from './dto/inputs/reset-password.input';
import { ConfirmResetPasswordInput } from './dto/inputs/confirm-reset-password.input';

interface RegisterJwtPayload {
  sub: string;
  email: string;
}

interface ResetPasswordJwtPayload {
  sub: string;
  email: string;
}

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

    const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
    return this.usersService.create({ email, hashedPassword });
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

    if (existingRequest && hasExpired) {
      await this.signUpRequestRepository.deleteById(existingRequest.id);
    }

    const hashedPassword = await bcrypt.hash(input.password, bcrypt.genSaltSync());
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const request = await this.signUpRequestRepository.create({
      email: input.email,
      name: input.name,
      hashedPassword,
      expiresAt,
    });

    const token = await this.jwtService.signAsync(
      { sub: request.id, email: request.email },
      {
        secret: this.configService.getOrThrow<string>('REGISTER_JWT_SECRET'),
        expiresIn: '24h',
      },
    );

    const pageUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const confirmLink = `${pageUrl}/confirm-register?token=${encodeURIComponent(token)}`;

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
    let payload: RegisterJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<RegisterJwtPayload>(input.token, {
        secret: this.configService.getOrThrow<string>('REGISTER_JWT_SECRET'),
      });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new BadRequestException('Token expired');
      }
      throw new BadRequestException('Invalid or expired token');
    }

    const request = await this.signUpRequestRepository.findById(payload.sub);
    if (!request || request.email !== payload.email) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (request.expiresAt < new Date()) {
      await this.signUpRequestRepository.deleteById(request.id);
      throw new BadRequestException('Token expired');
    }

    const existingUser = await this.usersService.findByEmail(request.email);
    if (existingUser) {
      await this.signUpRequestRepository.deleteById(request.id);
      throw new ConflictException('Email already registered');
    }

    const user = await this.usersRepository.create({
      email: request.email,
      hashedPassword: request.hashedPassword,
      name: request.name,
    });

    await this.signUpRequestRepository.deleteById(request.id);

    return user;
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: AuthenticatedUser) {
    const payload = { email: user.email, sub: user.userId };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      return { message: 'If this email is registered, a reset link has been sent.' };
    }

    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
        expiresIn: '24h',
      },
    );

    const pageUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${pageUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await this.mailerService.sendEmail(
      {
        recipients: [{ address: user.email }],
        subject: 'Reset your password',
      },
      {
        template: 'reset-password',
        context: { resetLink, name: user.name },
      },
    );

    return { message: 'If this email is registered, a reset link has been sent.' };
  }

  async confirmPasswordReset(input: ConfirmResetPasswordInput): Promise<{ message: string }> {
    let payload: ResetPasswordJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<ResetPasswordJwtPayload>(input.token, {
        secret: this.configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
      });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new BadRequestException('Token expired');
      }
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user || user.id !== payload.sub) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, bcrypt.genSaltSync());
    await this.usersService.updatePassword(user.id, passwordHash);

    return { message: 'Password has been reset successfully.' };
  }
}
