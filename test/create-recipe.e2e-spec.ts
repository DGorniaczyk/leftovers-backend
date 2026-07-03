import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

describe('POST /recipes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const runId = randomUUID().slice(0, 8);
  const userId = `e2e-user-${runId}`;
  let accessToken: string;
  const createdRecipeIds: string[] = [];

  const validBody = {
    title: 'Tomato Soup',
    description: 'A warm, comforting classic.',
    category: 'SOUP',
    prepTime: 30,
    servings: 4,
    ingredients: ['2 tomatoes', '1 tsp salt', '500ml water'],
    steps: ['Boil tomatoes for 10 minutes.', 'Blend until smooth.', 'Season and serve.'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    await prisma.recipe.deleteMany({ where: { id: { in: createdRecipeIds } } });
    await prisma.users.delete({ where: { id: userId } });
    await app.close();
  });

  it('returns 201 with the created recipe when the request is valid', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validBody)
      .expect(201);

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
  });

  it('persists the recipe in the database', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validBody)
      .expect(201);

    createdRecipeIds.push(response.body.id);

    const row = await prisma.recipe.findUnique({ where: { id: response.body.id } });
    expect(row).not.toBeNull();
    expect(row!.title).toBe('Tomato Soup');
    expect(row!.author_id).toBe(userId);
  });

  it('sets the authorId from the JWT, not from the request body', async () => {
    const bodyWithFakeAuthor = { ...validBody, authorId: 'hacker-id' };

    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(bodyWithFakeAuthor)
      .expect(201);

    createdRecipeIds.push(response.body.id);

    expect(response.body.authorId).toBe(userId);
    expect(response.body.authorId).not.toBe('hacker-id');
  });

  it('returns 401 when no token is provided', async () => {
    await request(app.getHttpServer()).post('/recipes').send(validBody).expect(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody)
      .expect(401);
  });

  describe('validation', () => {
    const postRecipe = (body: object) =>
      request(app.getHttpServer())
        .post('/recipes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body);

    it('returns 400 when title is missing', async () => {
      const { title: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when title exceeds 100 characters', async () => {
      await postRecipe({ ...validBody, title: 'a'.repeat(101) }).expect(400);
    });

    it('returns 400 when description is missing', async () => {
      const { description: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when description exceeds 200 characters', async () => {
      await postRecipe({ ...validBody, description: 'a'.repeat(201) }).expect(400);
    });

    it('returns 400 when category is missing', async () => {
      const { category: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when category is not a valid enum value', async () => {
      await postRecipe({ ...validBody, category: 'PIZZA' }).expect(400);
    });

    it('returns 400 when prepTime is missing', async () => {
      const { prepTime: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when prepTime is less than 1', async () => {
      await postRecipe({ ...validBody, prepTime: 0 }).expect(400);
    });

    it('returns 400 when prepTime exceeds 600', async () => {
      await postRecipe({ ...validBody, prepTime: 601 }).expect(400);
    });

    it('returns 400 when servings is missing', async () => {
      const { servings: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when servings is not an allowed value', async () => {
      await postRecipe({ ...validBody, servings: 3 }).expect(400);
    });

    it('returns 400 when ingredients is missing', async () => {
      const { ingredients: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when ingredients is an empty array', async () => {
      await postRecipe({ ...validBody, ingredients: [] }).expect(400);
    });

    it('returns 400 when ingredients contains a non-string value', async () => {
      await postRecipe({ ...validBody, ingredients: [1, 2, 3] }).expect(400);
    });

    it('returns 400 when steps is missing', async () => {
      const { steps: _, ...body } = validBody;
      await postRecipe(body).expect(400);
    });

    it('returns 400 when steps is an empty array', async () => {
      await postRecipe({ ...validBody, steps: [] }).expect(400);
    });

    it('returns 400 when steps contains a non-string value', async () => {
      await postRecipe({ ...validBody, steps: [1, 2, 3] }).expect(400);
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
        const response = await postRecipe({ ...validBody, category }).expect(201);
        createdRecipeIds.push(response.body.id);
      }
    });

    it('accepts all valid servings values', async () => {
      const servingsOptions = [1, 2, 4, 6, 8];

      for (const servings of servingsOptions) {
        const response = await postRecipe({ ...validBody, servings }).expect(201);
        createdRecipeIds.push(response.body.id);
      }
    });
  });
});
