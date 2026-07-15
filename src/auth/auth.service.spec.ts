import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { SignupRequestsRepository } from './signup-requests.repository';
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { TokenExpiredError } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => {
  const actualBcrypt = jest.requireActual('bcrypt');
  return {
    ...actualBcrypt,
    hash: jest.fn(actualBcrypt.hash),
    compare: jest.fn(actualBcrypt.compare),
  };
});

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let signUpRequestRepository: jest.Mocked<SignupRequestsRepository>;
  let mailerService: jest.Mocked<MailerService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
            updatePassword: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'user-1', email: 'test@example.com', name: 'Test User' }),
          },
        },
        {
          provide: SignupRequestsRepository,
          useValue: {
            findByEmail: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'req-1', email: 'test@example.com' }),
            deleteById: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    usersRepository = module.get(UsersRepository);
    signUpRequestRepository = module.get(SignupRequestsRepository);
    mailerService = module.get(MailerService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'newuser@example.com',
      password: 'StrongPass123!',
      name: 'New User',
    };

    it('should throw ConflictException if user already exists', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1', email: dto.email } as any);

      await expect(authService.register(dto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException if a non-expired signup request already exists', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue({
        id: 'req-1',
        email: dto.email,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // In the future
      } as any);

      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should delete an expired signup request and proceed with registration', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue({
        id: 'expired-req',
        email: dto.email,
        expiresAt: new Date(Date.now() - 1000), // In the past
      } as any);

      await authService.register(dto);

      expect(signUpRequestRepository.deleteById).toHaveBeenCalledWith('expired-req');
      expect(signUpRequestRepository.create).toHaveBeenCalled();
    });

    it('should hash the password before storing the signup request', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue(null);

      await authService.register(dto);

      const createArgs = signUpRequestRepository.create.mock.calls[0][0];

      expect(createArgs.passwordHash).not.toEqual(dto.password);
      const match = await bcrypt.compare(dto.password, createArgs.passwordHash);
      expect(match).toBe(true);
    });

    it('should create a signup request with correct expiry', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue(null);

      const before = Date.now();
      await authService.register(dto);
      const after = Date.now();

      const createArgs = signUpRequestRepository.create.mock.calls[0][0];

      expect(createArgs.expiresAt).toBeInstanceOf(Date);
      const expiresIn = createArgs.expiresAt.getTime() - before;
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(expiresIn).toBeGreaterThanOrEqual(expectedMs - (after - before));
      expect(expiresIn).toBeLessThanOrEqual(expectedMs + 1000);
    });

    it('should sign a JWT with the signup request id and email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.create.mockResolvedValue({
        id: 'req-1',
        email: dto.email,
      } as any);

      await authService.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'req-1', email: dto.email },
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });

    it('should send a confirmation email with a confirmLink in the context', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue(null);

      await authService.register(dto);

      expect(mailerService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [{ address: dto.email }],
          subject: 'Confirm your account registration',
        }),
        expect.objectContaining({
          template: 'confirm-register',
          context: expect.objectContaining({
            confirmLink: expect.stringContaining('token='),
            name: dto.name,
          }),
        }),
      );
    });

    it('should return a success message', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      signUpRequestRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.register(dto);

      expect(result).toEqual({ message: 'Confirmation email sent!' });
    });
  });

  describe('confirmRegister', () => {
    const confirmDto = { token: 'valid-jwt-token' };

    it('should throw BadRequestException if token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token has expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow('Token expired');
    });

    it('should throw BadRequestException if signup request is not found', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'req-1', email: 'test@example.com' });
      signUpRequestRepository.findById.mockResolvedValue(null);

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if email in JWT does not match signup request', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'req-1', email: 'other@example.com' });
      signUpRequestRepository.findById.mockResolvedValue({
        id: 'req-1',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      } as any);

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if signup request has expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'req-1', email: 'test@example.com' });
      signUpRequestRepository.findById.mockResolvedValue({
        id: 'req-1',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() - 1000), // w przeszłości
      } as any);

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow('Token expired');
    });

    it('should create the user and delete the signup request on success', async () => {
      const signupRequest = {
        id: 'req-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };

      jwtService.verifyAsync.mockResolvedValue({ sub: 'req-1', email: 'test@example.com' });
      signUpRequestRepository.findById.mockResolvedValue(signupRequest as any);

      await authService.confirmRegister(confirmDto);

      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: signupRequest.email,
          passwordHash: signupRequest.passwordHash,
          name: signupRequest.name,
        }),
      );
      expect(signUpRequestRepository.deleteById).toHaveBeenCalledWith(signupRequest.id);
    });
  });

  describe('resetPassword', () => {
    const resetDto = { email: 'test@example.com' };

    it('should return a generic message and not send email if user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.resetPassword(resetDto);

      expect(mailerService.sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If this email is registered, a reset link has been sent.',
      });
    });

    it('should send a reset password email if the user exists', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: resetDto.email,
        name: 'Test User',
      } as any);

      await authService.resetPassword(resetDto);

      expect(mailerService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [{ address: resetDto.email }],
          subject: 'Reset your password',
        }),
        expect.objectContaining({
          template: 'reset-password',
          context: expect.objectContaining({
            resetLink: expect.stringContaining('token='),
          }),
        }),
      );
    });

    it('should sign a JWT with the user id and email', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: resetDto.email,
        name: 'Test User',
      } as any);

      await authService.resetPassword(resetDto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', email: resetDto.email },
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });

    it('should return a generic message regardless of whether user exists (anti-enumeration)', async () => {
      const expectedResponse = {
        message: 'If this email is registered, a reset link has been sent.',
      };

      usersService.findByEmail.mockResolvedValue(null);
      const resultNoUser = await authService.resetPassword(resetDto);

      usersService.findByEmail.mockResolvedValue({ id: 'user-1', email: resetDto.email } as any);
      const resultWithUser = await authService.resetPassword(resetDto);

      expect(resultNoUser).toEqual(expectedResponse);
      expect(resultWithUser).toEqual(expectedResponse);
    });
  });

  describe('confirmPasswordReset', () => {
    const confirmResetDto = { token: 'valid-reset-token', newPassword: 'NewStrongPass123!' };

    it('should throw BadRequestException if the token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(authService.confirmPasswordReset(confirmResetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if the token has expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new TokenExpiredError('jwt expired', new Date()));

      await expect(authService.confirmPasswordReset(confirmResetDto)).rejects.toThrow(
        'Token expired',
      );
    });

    it('should throw BadRequestException if user is not found', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'test@example.com' });
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.confirmPasswordReset(confirmResetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user id does not match token sub', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'different-user-id',
        email: 'test@example.com',
      });
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as any);

      await expect(authService.confirmPasswordReset(confirmResetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should hash the new password and update the user', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'test@example.com' });
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as any);

      await authService.confirmPasswordReset(confirmResetDto);

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));

      const hashedPassword = usersService.updatePassword.mock.calls[0][1];
      const match = await bcrypt.compare(confirmResetDto.newPassword, hashedPassword);
      expect(match).toBe(true);
    });

    it('should return a success message', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'test@example.com' });
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      } as any);

      const result = await authService.confirmPasswordReset(confirmResetDto);

      expect(result).toEqual({ message: 'Password has been reset successfully.' });
    });
  });
});
