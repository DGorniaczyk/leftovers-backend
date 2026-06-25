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
import { User } from './interface/user.interface';
import { MailerService } from 'src/mailer/mailer.service';
import { SignupRequestsRepository } from './signup-requests.repository';
import { ConfirmRegisterDto } from './dto/confirm-register.dto';
import { randomBytes } from 'crypto';
import { SignUpDto } from './dto/SignUp.dto';

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
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
    return this.usersService.create(email, hashedPassword);
  }

  async register(dto: SignUpDto) {
    // check if user exists in the user database and if there is already a registration request present
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingRegisterRequest =
      await this.signUpRequestRepository.findByEmail(dto.email);

    const hasExpired =
      existingRegisterRequest &&
      existingRegisterRequest.expires_at < new Date();

    if (existingRegisterRequest && !hasExpired) {
      throw new ConflictException('Email already registered');
    }

    if (hasExpired) {
      await this.signUpRequestRepository.deleteById(existingRegisterRequest.id);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      bcrypt.genSaltSync(),
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.signUpRequestRepository.create({
      email: dto.email,
      name: dto.name,
      password_hash: hashedPassword,
      token,
      expires_at: expiresAt,
    });

    const pageUrl =
      this.configService.get<string>('PAGE_URL') || 'http://localhost:3000';

    const confirmLink = `${pageUrl}/confirm-register?email=${encodeURIComponent(
      dto.email,
    )}&token=${encodeURIComponent(token)}`;

    await this.mailerService.sendEmail(
      {
        recipients: [{ address: dto.email }],
        subject: 'Confirm your account registration',
      },
      {
        template: 'confirm-register',
        context: { confirmLink, name: dto.name },
      },
    );
    return { message: 'Confirmation email sent!' };
  }

  async confirmRegister(dto: ConfirmRegisterDto) {
    const request = await this.signUpRequestRepository.findByToken(dto.token);
    if (!request) {
      throw new BadRequestException('Invalid or expired token');
    }
    if (request.expires_at < new Date()) {
      throw new BadRequestException('Token expired');
    }

    const user = await this.usersRepository.create(
      request.email,
      request.password_hash,
      request.name,
    );

    this.signUpRequestRepository.deleteById(request.id);

    return { id: user.id, email: user.email };
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
