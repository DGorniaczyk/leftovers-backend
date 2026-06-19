import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('../users/users.service', () => ({
  UsersService: jest.fn().mockImplementation(() => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
  })),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, UsersService],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
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

    it('should throw bad request exception for invalid credentials', async () => {
      const email = 'test';
      const password = '';
      await expect(authService.signUp(email, password)).rejects.toThrow(
        'Email/Password is invalid',
      );
    });

    it('should call UsersService.create with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      await authService.signUp(email, password);
      expect(usersService.create).toHaveBeenCalledWith(
        email,
        expect.any(String),
      );
    });
  });
});
