import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { afterEach } from 'node:test';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  const user = {
    email: 'test@example.com',
    password: 'password123',
  };

  const badUser = {
    email: 'test',
    password: '',
  };

  it('{POST} - register user with bad credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(badUser)
      .expect(400);
  });

  it('{POST} - register user that already exists', async () => {
    await request(app.getHttpServer()).post('/auth/signup').send(user);

    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(409);
  });

  it('{POST} - register user', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });
});
