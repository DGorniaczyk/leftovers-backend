import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

describe('GET /recipes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Unique-ish IDs per test run so reruns / parallel runs don't collide.
  const runId = randomUUID().slice(0, 8);

  const userOneId = `e2e-user-1-${runId}`;
  const userTwoId = `e2e-user-2-${runId}`;

  let publicRecipeId: string;
  let ownPrivateRecipeId: string;
  let otherPrivateRecipeId: string;

  let accessTokenUserOne: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Seed two users (recipe.author_id is a required FK to users.id).
    await prisma.users.createMany({
      data: [
        { id: userOneId, email: `${userOneId}@example.com`, password: 'unused-hash' },
        { id: userTwoId, email: `${userTwoId}@example.com`, password: 'unused-hash' },
      ],
    });

    // Seed recipes: one public, one private owned by user-1, one private owned by user-2.
    const publicRecipe = await prisma.recipe.create({
      data: {
        title: `E2E Public Soup ${runId}`,
        description: 'Visible to everyone',
        prep_time: 20,
        is_public: true,
        author_id: userOneId,
        rating: 4,
        category: 'soup',
        ingredients: 'tomato, salt',
        steps: 'boil, serve',
      },
    });
    publicRecipeId = publicRecipe.id;

    const ownPrivateRecipe = await prisma.recipe.create({
      data: {
        title: `E2E Private Stew ${runId}`,
        description: 'Only user-1 should see this',
        prep_time: 45,
        is_public: false,
        author_id: userOneId,
        rating: 5,
        category: 'stew',
        ingredients: 'beef, carrot',
        steps: 'simmer for hours',
      },
    });
    ownPrivateRecipeId = ownPrivateRecipe.id;

    const otherPrivateRecipe = await prisma.recipe.create({
      data: {
        title: `E2E Private Snack ${runId}`,
        description: 'Should never be visible to user-1',
        prep_time: 10,
        is_public: false,
        author_id: userTwoId,
        rating: 3,
        category: 'snack',
        ingredients: 'chips',
        steps: 'open bag',
      },
    });
    otherPrivateRecipeId = otherPrivateRecipe.id;

    // Sign a real access token the same way AuthService.login() does, so the
    // JwtStrategy / OptionalJwtAuthGuard validate it through the real flow.
    accessTokenUserOne = await jwtService.signAsync({
      email: `${userOneId}@example.com`,
      sub: userOneId,
    });
  });

  afterAll(async () => {
    await prisma.recipe.deleteMany({
      where: { id: { in: [publicRecipeId, ownPrivateRecipeId, otherPrivateRecipeId] } },
    });
    await prisma.users.deleteMany({
      where: { id: { in: [userOneId, userTwoId] } },
    });
    await app.close();
  });

  it('returns 200 with only public recipes for a guest (no auth header)', async () => {
    const response = await request(app.getHttpServer()).get('/recipes').expect(200);

    const ids = response.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(publicRecipeId);
    expect(ids).not.toContain(ownPrivateRecipeId);
    expect(ids).not.toContain(otherPrivateRecipeId);
  });

  it('returns public recipes + the authenticated user own private recipes', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', `Bearer ${accessTokenUserOne}`)
      .expect(200);

    const ids = response.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(publicRecipeId);
    expect(ids).toContain(ownPrivateRecipeId);
    expect(ids).not.toContain(otherPrivateRecipeId);
  });

  it('does not treat an invalid/garbage token as a hard failure (falls back to guest)', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(200);

    const ids = response.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(publicRecipeId);
    expect(ids).not.toContain(ownPrivateRecipeId);
  });

  it('returns only summary fields when details is not set', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .query({ category: 'soup' })
      .expect(200);

    const recipe = response.body.find((r: { id: string }) => r.id === publicRecipeId);
    expect(recipe).toBeDefined();
    expect(Object.keys(recipe).sort()).toEqual(['id', 'title', 'description', 'prepTime'].sort());
  });

  it('returns full recipe details when details=true', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .query({ category: 'soup', details: 'true' })
      .expect(200);

    const recipe = response.body.find((r: { id: string }) => r.id === publicRecipeId);
    expect(recipe).toMatchObject({
      id: publicRecipeId,
      ingredients: 'tomato, salt',
      steps: 'boil, serve',
      isPublic: true,
      authorId: userOneId,
    });
  });

  it('filters by category', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .query({ category: 'stew' })
      .set('Authorization', `Bearer ${accessTokenUserOne}`)
      .expect(200);

    const ids = response.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(ownPrivateRecipeId);
    expect(ids).not.toContain(publicRecipeId);
  });

  it('filters by minimum rating', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .query({ rating: 5 })
      .set('Authorization', `Bearer ${accessTokenUserOne}`)
      .expect(200);

    const ids = response.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(ownPrivateRecipeId); // rating 5
    expect(ids).not.toContain(publicRecipeId); // rating 4
  });

  it('rejects an out-of-range rating query param with 400', async () => {
    await request(app.getHttpServer()).get('/recipes').query({ rating: 10 }).expect(400);
  });

  it('returns 200 with an empty array when filters match nothing', async () => {
    const response = await request(app.getHttpServer())
      .get('/recipes')
      .query({ category: `nonexistent-category-${runId}` })
      .expect(200);

    expect(response.body).toEqual([]);
  });
});
