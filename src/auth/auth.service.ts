import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RESET_PASSWORD_TOKEN_JWT_SERVICE } from './reset-password-token.module';
import { TokenExpiredError } from 'jsonwebtoken';
import { User as AuthenticatedUser } from './interface/user.interface';
import { User } from '../users/models/user.model';
import { MailerService } from 'src/mailer/mailer.service';
import { SignupRequestsRepository } from './signup-requests.repository';
import { RegisterInput } from './dto/inputs/register-input.dto';
import { ConfirmRegisterInput } from './dto/inputs/confirm-register-input.dto';
import { ResetPasswordInput } from './dto/inputs/reset-password.input';
import { ConfirmResetPasswordInput } from './dto/inputs/confirm-reset-password.input';
import { ResetPasswordResult } from './dto/reset-password-result.dto';

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
  private readonly frontendUrl: string;
  private readonly registerJwtSecret: string;
  private readonly resetPasswordJwtService: JwtService;
  private readonly bcryptSaltRounds: number;
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    @Inject(RESET_PASSWORD_TOKEN_JWT_SERVICE)
    private readonly resetPasswordJwtServiceInjected: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly signUpRequestRepository: SignupRequestsRepository,
  ) {
    this.registerJwtSecret = this.configService.getOrThrow<string>('REGISTER_JWT_SECRET');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.resetPasswordJwtService = this.resetPasswordJwtServiceInjected;
    const roundsStr = this.configService.getOrThrow<string>('BCRYPT_SALT_ROUNDS');
    const rounds = Number(roundsStr);
    if (!Number.isInteger(rounds) || rounds < 1) {
      throw new Error('Invalid BCRYPT_SALT_ROUNDS; must be a positive integer');
    }
    this.bcryptSaltRounds = rounds;
  }

  // This is to be depricated at a later date as we will be using the verify mail version
  async signUp(email: string, password: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, this.bcryptSaltRounds);
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

    const hashedPassword = await bcrypt.hash(input.password, this.bcryptSaltRounds);
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
        secret: this.registerJwtSecret,
        expiresIn: '24h',
      },
    );

    const confirmLink = `${this.frontendUrl}/confirm-register?token=${encodeURIComponent(token)}`;

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
        secret: this.registerJwtSecret,
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
      return new ResetPasswordResult();
    }

    const token = await this.resetPasswordJwtService.signAsync({ sub: user.id, email: user.email });

    const resetLink = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

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

    return new ResetPasswordResult();
  }

  async confirmPasswordReset(input: ConfirmResetPasswordInput): Promise<{ message: string }> {
    let payload: ResetPasswordJwtPayload;

    try {
      payload = await this.resetPasswordJwtService.verifyAsync<ResetPasswordJwtPayload>(input.token);
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

    const passwordHash = await bcrypt.hash(input.newPassword, this.bcryptSaltRounds);
    await this.usersService.updatePassword(user.id, passwordHash);

    return { message: 'Password has been reset successfully.' };
  }
}
