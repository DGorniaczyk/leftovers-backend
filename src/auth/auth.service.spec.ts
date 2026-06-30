import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('../users/users.service', () => ({
  UsersService: jest.fn().mockImplementation(() => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
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
  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, UsersService, JwtService],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('signUp', () => {
    it('should call UsersService.findByEmail with correct email', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      await authService.signUp(email, password);
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should throw conflict exception if user already exists', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      jest
        .spyOn(usersService, 'findByEmail')
        .mockResolvedValue({ id: '1', email });
      await expect(authService.signUp(email, password)).rejects.toThrow(
        'User already exists',
      );
    });

    it('should call UsersService.create with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await authService.signUp(email, password);

      expect(usersService.create).toHaveBeenCalled();
      const calledArgs = (usersService.create as jest.Mock).mock.calls[0];
      const passedPasswordHash = calledArgs[1];

      expect(passedPasswordHash).not.toEqual(password);

      const match = await bcrypt.compare(password, passedPasswordHash);
      expect(match).toBe(true);
    });
  });

  describe('validateUser', () => {
    it('should return the user when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
      const mockUser = { id: '1', email, password: hashedPassword };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      const result = await authService.validateUser(email, password);

      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const email = 'test@example.com';
      const password = 'wrongPassword';
      const hashedPassword = await bcrypt.hash(
        'correctPassword',
        bcrypt.genSaltSync(),
      );
      const mockUser = { id: '1', email, password: hashedPassword };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should call bcrypt.compare with the provided password and stored hash', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, bcrypt.genSaltSync());
      const mockUser = { id: '1', email, password: hashedPassword };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      await authService.validateUser(email, password);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });
  });

  describe('login', () => {
    it('should return an access token', async () => {
      const user = { email: 'test@example.com', userId: '1' };

      const result = await authService.login(user as any);

      expect(result).toEqual({ accessToken: 'signed-jwt-token' });
    });

    it('should call jwtService.signAsync with correct payload', async () => {
      const user = { email: 'test@example.com', userId: '1' };

      await authService.login(user as any);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        email: user.email,
        sub: user.userId,
      });
    });
  });
});
