import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './../src/app.config';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const registrationUser = {
    email: 'register@example.com',
    password: 'Password123!',
    name: 'Jane Doe',
  };

  const user = {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'John Smith',
  };

  const invalidCredentialsUser = {
    email: 'test',
    password: '',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await prisma.signup_requests.deleteMany({});
    await prisma.users.deleteMany({});
    await app.close();
  });

  afterEach(async () => {
    await prisma.signup_requests.deleteMany({});
    await prisma.users.deleteMany({});
  });

  describe('auth/signup', () => {
    it('should return bad request for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send(invalidCredentialsUser)
        .expect(400);
    });

    it('should return conflict for existing user', async () => {
      await request(app.getHttpServer()).post('/auth/signup').send(user);

      return request(app.getHttpServer()).post('/auth/signup').send(user).expect(409);
    });

    it('should register user', () => {
      return request(app.getHttpServer()).post('/auth/signup').send(user).expect(201);
    });
  });

  describe('auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/signup').send(user);
    });

    it('should return unauthorized for malformed credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidCredentialsUser)
        .expect(401);
    });

    it('should return unauthorized for a non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'doesnotexist@example.com', password: 'Password123!' })
        .expect(401);
    });

    it('should return unauthorized for an incorrect password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'WrongPassword123!' })
        .expect(401);
    });

    it('should log in successfully and return an access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(user)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });
  });

  describe('auth/register', () => {
    it('should start registration and send confirmation email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registrationUser)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Confirmation email sent!' });

      const signupRequest = await prisma.signup_requests.findFirst({
        where: { email: registrationUser.email },
      });

      expect(signupRequest).toBeTruthy();
      expect(signupRequest?.email).toBe(registrationUser.email);
    });

    it('should reject duplicate registration request', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registrationUser)
        .expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registrationUser)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('auth/confirm-register', () => {
    it('should create user from valid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registrationUser)
        .expect(HttpStatus.OK);

      const signupRequest = await prisma.signup_requests.findFirst({
        where: { email: registrationUser.email },
      });
      expect(signupRequest).toBeTruthy();

      const token = await jwtService.signAsync(
        { sub: signupRequest!.id, email: signupRequest!.email },
        {
          secret: configService.getOrThrow<string>('REGISTER_JWT_SECRET'),
          expiresIn: '24h',
        },
      );

      const response = await request(app.getHttpServer())
        .post('/auth/confirm-register')
        .send({ token })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(registrationUser.email);

      const userInDb = await prisma.users.findUnique({
        where: { email: registrationUser.email },
      });
      expect(userInDb).toBeTruthy();
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/confirm-register')
        .send({ token: 'invalid-token' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject expired token', async () => {
      const expiredToken = await jwtService.signAsync(
        { sub: 'some-id', email: registrationUser.email },
        {
          secret: configService.getOrThrow<string>('REGISTER_JWT_SECRET'),
          expiresIn: '-1s',
        },
      );

      await request(app.getHttpServer())
        .post('/auth/confirm-register')
        .send({ token: expiredToken })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('auth/reset-password', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/signup').send(user);
    });

    it('should return 200 OK when email exists', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ email: user.email })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'If this email is registered, a reset link has been sent.',
      });
    });

    it('should return 200 OK even when email does not exist (anti-enumeration)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        message: 'If this email is registered, a reset link has been sent.',
      });
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ email: 'not-an-email' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('auth/confirm-reset-password', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/signup').send(user);
    });

    it('should reset password with a valid token', async () => {
      const userInDb = await prisma.users.findUnique({ where: { email: user.email } });

      const token = await jwtService.signAsync(
        { sub: userInDb!.id, email: userInDb!.email },
        {
          secret: configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
          expiresIn: '24h',
        },
      );

      const response = await request(app.getHttpServer())
        .post('/auth/confirm-reset-password')
        .send({ token, newPassword: 'NewPassword123!' })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({ message: 'Password has been reset successfully.' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'NewPassword123!' })
        .expect(HttpStatus.OK);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/confirm-reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewPassword123!' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject expired token', async () => {
      const userInDb = await prisma.users.findUnique({ where: { email: user.email } });

      const expiredToken = await jwtService.signAsync(
        { sub: userInDb!.id, email: userInDb!.email },
        {
          secret: configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
          expiresIn: '-1s',
        },
      );

      await request(app.getHttpServer())
        .post('/auth/confirm-reset-password')
        .send({ token: expiredToken, newPassword: 'NewPassword123!' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject weak new password', async () => {
      const userInDb = await prisma.users.findUnique({ where: { email: user.email } });

      const token = await jwtService.signAsync(
        { sub: userInDb!.id, email: userInDb!.email },
        {
          secret: configService.getOrThrow<string>('RESET_PASSWORD_JWT_SECRET'),
          expiresIn: '24h',
        },
      );

      await request(app.getHttpServer())
        .post('/auth/confirm-reset-password')
        .send({ token, newPassword: 'weak' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
