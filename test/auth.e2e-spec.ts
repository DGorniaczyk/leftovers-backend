import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/app.config';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
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

      expect(response.body).toEqual({
        message: 'Confirmation email sent!',
      });

      const signupRequest = await prisma.signup_requests.findFirst({
        where: {
          email: registrationUser.email,
        },
      });

      expect(signupRequest).toBeTruthy();
      expect(signupRequest?.token).toBeTruthy();
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
        where: {
          email: registrationUser.email,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/confirm-register')
        .send({
          email: signupRequest!.email,
          token: signupRequest!.token,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(registrationUser.email);

      const userInDb = await prisma.users.findUnique({
        where: {
          email: registrationUser.email,
        },
      });

      expect(userInDb).toBeTruthy();
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/confirm-register')
        .send({
          token: 'invalid-token',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  afterEach(async () => {
    await prisma.signup_requests.deleteMany({});
    await prisma.users.deleteMany({});
    await app.close();
  });
});
