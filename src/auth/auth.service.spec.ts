import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { SignupRequestsRepository } from './signup-requests.repository';
import { MailerService } from '../mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('../users/users.service', () => ({
  UsersService: jest.fn().mockImplementation(() => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
  })),
}));

jest.mock('../users/users.repository', () => ({
  UsersRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    }),
  })),
}));

jest.mock('./signup-requests.repository', () => ({
  SignupRequestsRepository: jest.fn().mockImplementation(() => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    findByToken: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'req-1' }),
    deleteById: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../mailer/mailer.service', () => ({
  MailerService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  })),
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
  })),
}));

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
  let usersService: UsersService;
  let usersRepository: UsersRepository;
  let signUpRequestRepository: SignupRequestsRepository;
  let mailerService: MailerService;
  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        UsersRepository,
        SignupRequestsRepository,
        MailerService,
        ConfigService,
        JwtService,
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
    jest.restoreAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'newuser@example.com',
      password: 'StrongPass123!',
      name: 'New User',
    };

    it('should throw ConflictException if user already exists', async () => {
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue({ id: '1', email: dto.email } as any);

      await expect(authService.register(dto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException if a non-expired signup request already exists', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue({
        id: 'req-1',
        email: dto.email,
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      } as any);

      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should delete an expired signup request and proceed with registration', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue({
        id: 'expired-req',
        email: dto.email,
        expires_at: new Date(Date.now() - 1000), // already expired
      } as any);

      await authService.register(dto);

      expect(signUpRequestRepository.deleteById).toHaveBeenCalledWith('expired-req');
      expect(signUpRequestRepository.create).toHaveBeenCalled();
    });

    it('should hash the password before storing the signup request', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue(null);

      await authService.register(dto);

      const createArgs = (signUpRequestRepository.create as jest.Mock).mock.calls[0][0];

      expect(createArgs.password_hash).not.toEqual(dto.password);
      const match = await bcrypt.compare(dto.password, createArgs.password_hash);
      expect(match).toBe(true);
    });

    it('should generate a token and expiry, and store them on the signup request', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue(null);

      await authService.register(dto);

      const createArgs = (signUpRequestRepository.create as jest.Mock).mock.calls[0][0];

      expect(createArgs.token).toBeDefined();
      expect(typeof createArgs.token).toBe('string');
      expect(createArgs.token.length).toBeGreaterThan(0);
      expect(createArgs.expires_at).toBeInstanceOf(Date);
      expect(createArgs.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('should send a confirmation email with a confirmLink in the context', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue(null);

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
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(signUpRequestRepository, 'findByEmail').mockResolvedValue(null);

      const result = await authService.register(dto);

      expect(result).toEqual({ message: 'Confirmation email sent!' });
    });
  });

  describe('confirmRegister', () => {
    const confirmDto = { token: 'valid-token-abc123' };

    it('should throw BadRequestException if token does not match any request', async () => {
      jest.spyOn(signUpRequestRepository, 'findByToken').mockResolvedValue(null);

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if the token has expired', async () => {
      jest.spyOn(signUpRequestRepository, 'findByToken').mockResolvedValue({
        id: 'req-1',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed',
        token: confirmDto.token,
        expires_at: new Date(Date.now() - 1000),
      } as any);

      await expect(authService.confirmRegister(confirmDto)).rejects.toThrow('Token expired');
    });

    it('should create the user and delete the signup request on success', async () => {
      const requestRecord = {
        id: 'req-1',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        token: confirmDto.token,
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      };
      jest.spyOn(signUpRequestRepository, 'findByToken').mockResolvedValue(requestRecord as any);

      const result = await authService.confirmRegister(confirmDto);

      expect(usersRepository.create).toHaveBeenCalledWith(
        requestRecord.email,
        requestRecord.password_hash,
        requestRecord.name,
      );
      expect(signUpRequestRepository.deleteById).toHaveBeenCalledWith(requestRecord.id);
      expect(result).toEqual({ id: 'user-1', email: 'test@example.com' });
    });
  });
});
