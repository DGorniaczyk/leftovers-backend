import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const user = {
    email: 'test@example.com',
    password: 'password123',
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

      return request(app.getHttpServer())
        .post('/auth/signup')
        .send(user)
        .expect(409);
    });

    it('should register user', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send(user)
        .expect(201);
    });
  });

  afterEach(async () => {
    await prisma.users.deleteMany({});
    await app.close();
  });
});
