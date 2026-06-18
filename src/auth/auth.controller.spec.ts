import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('../users/users.service', () => ({
  UsersService: jest.fn().mockImplementation(() => ({
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
  })),
}));

describe('AuthController', () => {
  let authcontroller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const moduleref: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, UsersService],
    }).compile();

    authcontroller = moduleref.get(AuthController);
    authService = moduleref.get(AuthService);
  });

  describe('signup', () => {
    it('should call AuthService.signUp with correct parameters', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const signUpSpy = jest
        .spyOn(authService, 'signUp')
        .mockResolvedValue({ id: '1', email });

      await authcontroller.signUp({ email, password });

      expect(signUpSpy).toHaveBeenCalledWith(email, password);
    });

    it('should return bad request from AuthService.signUp', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      jest
        .spyOn(authService, 'signUp')
        .mockRejectedValue(new Error('User already exists'));

      await expect(authcontroller.signUp({ email, password })).rejects.toThrow(
        'User already exists',
      );
    });

    it('should return the bad credentials response from AuthService.signUp', async () => {
      const email = 'test';
      const password = '';

      jest
        .spyOn(authService, 'signUp')
        .mockRejectedValue(new Error('Invalid credentials'));

      await expect(authcontroller.signUp({ email, password })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
