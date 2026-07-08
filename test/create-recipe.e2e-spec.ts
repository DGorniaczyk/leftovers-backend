import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UploadService } from '../src/upload/upload.service';
import { configureApp } from '../src/app.config';

// Fake S3 key returned by the mocked upload service
const FAKE_KEY = 'recipes/e2e-test-fake.jpg';
const FAKE_URL = 'https://s3.example.com/recipes/e2e-test-fake.jpg?signature=xxx';

// Tiny valid JPEG buffer (1x1 px white JPEG)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
    'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
    'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
    'MjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAA' +
    'AAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAA' +
    'AAAA/9oADAMBAAIRAxEAPwCwABmX/9k=',
  'base64',
);

describe('POST /recipes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const runId = randomUUID().slice(0, 8);
  const userId = `e2e-user-${runId}`;
  let accessToken: string;
  const createdRecipeIds: string[] = [];

  // Temp file path for multipart upload in tests
  const tmpImagePath = join(__dirname, `tmp-test-image-${runId}.jpg`);

  const attachRecipe = (req: request.Test, overrides: Record<string, unknown> = {}) => {
    const fields: Record<string, string> = {
      title: 'Tomato Soup',
      description: 'A warm, comforting classic.',
      category: 'SOUP',
      prepTime: '30',
      servings: '4',
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };

    let r = req;
    for (const [key, value] of Object.entries(fields)) {
      r = r.field(key, value);
    }

    const ingredients = (overrides.ingredients as string[]) ?? [
      '2 tomatoes',
      '1 tsp salt',
      '500ml water',
    ];
    const steps = (overrides.steps as string[]) ?? [
      'Boil tomatoes for 10 minutes.',
      'Blend until smooth.',
      'Season and serve.',
    ];

    for (const ingredient of ingredients) {
      r = r.field('ingredients', ingredient);
    }
    for (const step of steps) {
      r = r.field('steps', step);
    }

    if (overrides.skipImage !== true) {
      r = r.attach('coverImage', tmpImagePath, { contentType: 'image/jpeg' });
    }

    return r;
  };

  beforeAll(async () => {
    writeFileSync(tmpImagePath, TINY_JPEG);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UploadService)
      .useValue({
        upload: jest.fn().mockResolvedValue(undefined),
        getFileUrl: jest.fn().mockResolvedValue(FAKE_URL),
        remove: jest.fn().mockResolvedValue(true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    await prisma.users.create({
      data: { id: userId, email: `${userId}@example.com`, password: 'unused-hash' },
    });

    accessToken = await jwtService.signAsync({
      email: `${userId}@example.com`,
      sub: userId,
    });
  });

  afterAll(async () => {
    unlinkSync(tmpImagePath);
    await prisma.recipe.deleteMany({ where: { id: { in: createdRecipeIds } } });
    await prisma.users.delete({ where: { id: userId } });
    await app.close();
  });

  it('returns 201 with the created recipe when the request is valid', async () => {
    const response = await attachRecipe(
      request(app.getHttpServer()).post('/recipes').set('Authorization', `Bearer ${accessToken}`),
    ).expect(201);

    createdRecipeIds.push(response.body.id);

    expect(response.body).toMatchObject({
      title: 'Tomato Soup',
      description: 'A warm, comforting classic.',
      category: 'SOUP',
      prepTime: 30,
      servings: 4,
      ingredients: ['2 tomatoes', '1 tsp salt', '500ml water'],
      steps: ['Boil tomatoes for 10 minutes.', 'Blend until smooth.', 'Season and serve.'],
      isPublic: true,
      authorId: userId,
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.coverImageKey).toMatch(/^recipes\/.+\.jpg$/);
    expect(response.body.coverImageUrl).toBe(FAKE_URL);
  });

  it('persists the recipe in the database', async () => {
    const response = await attachRecipe(
      request(app.getHttpServer()).post('/recipes').set('Authorization', `Bearer ${accessToken}`),
    ).expect(201);

    createdRecipeIds.push(response.body.id);

    const row = await prisma.recipe.findUnique({ where: { id: response.body.id } });
    expect(row).not.toBeNull();
    expect(row!.title).toBe('Tomato Soup');
    expect(row!.author_id).toBe(userId);
    expect(row!.cover_image_key).toMatch(/^recipes\/.+\.jpg$/);
  });

  it('sets the authorId from the JWT, not from the request body', async () => {
    const response = await attachRecipe(
      request(app.getHttpServer()).post('/recipes').set('Authorization', `Bearer ${accessToken}`),
      { authorId: 'hacker-id' },
    ).expect(201);

    createdRecipeIds.push(response.body.id);

    expect(response.body.authorId).toBe(userId);
    expect(response.body.authorId).not.toBe('hacker-id');
  });

  it('returns 401 when no token is provided', async () => {
    await attachRecipe(request(app.getHttpServer()).post('/recipes')).expect(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    await attachRecipe(
      request(app.getHttpServer()).post('/recipes').set('Authorization', 'Bearer not-a-real-token'),
    ).expect(401);
  });

  it('returns 400 when cover image is missing', async () => {
    await attachRecipe(
      request(app.getHttpServer()).post('/recipes').set('Authorization', `Bearer ${accessToken}`),
      { skipImage: true },
    ).expect(400);
  });

  describe('validation', () => {
    const postRecipe = (overrides: Record<string, unknown> = {}) =>
      attachRecipe(
        request(app.getHttpServer()).post('/recipes').set('Authorization', `Bearer ${accessToken}`),
        overrides,
      );

    it('returns 400 when title is missing', async () => {
      await postRecipe({ title: '' }).expect(400);
    });

    it('returns 400 when title exceeds 100 characters', async () => {
      await postRecipe({ title: 'a'.repeat(101) }).expect(400);
    });

    it('returns 400 when description is missing', async () => {
      await postRecipe({ description: '' }).expect(400);
    });

    it('returns 400 when description exceeds 200 characters', async () => {
      await postRecipe({ description: 'a'.repeat(201) }).expect(400);
    });

    it('returns 400 when category is not a valid enum value', async () => {
      await postRecipe({ category: 'PIZZA' }).expect(400);
    });

    it('returns 400 when prepTime is less than 1', async () => {
      await postRecipe({ prepTime: '0' }).expect(400);
    });

    it('returns 400 when prepTime exceeds 600', async () => {
      await postRecipe({ prepTime: '601' }).expect(400);
    });

    it('returns 400 when servings is not an allowed value', async () => {
      await postRecipe({ servings: '3' }).expect(400);
    });

    it('accepts all valid category values', async () => {
      const categories = [
        'BREAKFAST',
        'LUNCH',
        'DINNER',
        'DESSERT',
        'SNACK',
        'APPETIZER',
        'SOUP',
        'SALAD',
        'BEVERAGE',
        'OTHER',
      ];

      for (const category of categories) {
        const response = await postRecipe({ category }).expect(201);
        createdRecipeIds.push(response.body.id);
      }
    });

    it('accepts all valid servings values', async () => {
      const servingsOptions = [1, 2, 4, 6, 8];

      for (const servings of servingsOptions) {
        const response = await postRecipe({ servings: String(servings) }).expect(201);
        createdRecipeIds.push(response.body.id);
      }
    });
  });
});
