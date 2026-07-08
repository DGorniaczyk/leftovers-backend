import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UploadService } from '../src/upload/upload.service';
import { configureApp } from '../src/app.config';

const FAKE_URL = 'https://s3.example.com/recipes/fake.jpg?signature=xxx';

describe('GET /recipes/:id (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const runId = randomUUID().slice(0, 8);

  const ownerId = `e2e-owner-${runId}`;
  const otherUserId = `e2e-other-${runId}`;

  let publicRecipeId: string;
  let ownerPrivateRecipeId: string;

  let ownerToken: string;
  let otherUserToken: string;

  beforeAll(async () => {
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

    await prisma.users.createMany({
      data: [
        { id: ownerId, email: `${ownerId}@example.com`, password: 'unused-hash' },
        { id: otherUserId, email: `${otherUserId}@example.com`, password: 'unused-hash' },
      ],
    });

    const publicRecipe = await prisma.recipe.create({
      data: {
        title: `E2E Detail Public ${runId}`,
        description: 'Visible to everyone',
        prep_time_minutes: 15,
        servings: 2,
        is_public: true,
        author_id: ownerId,
        rating: 4,
        category: 'SNACK',
        ingredients: ['bread', 'butter'],
        steps: ['spread butter on bread', 'eat'],
        cover_image_key: `recipes/e2e-detail-public-${runId}.jpg`,
      },
    });
    publicRecipeId = publicRecipe.id;

    const privateRecipe = await prisma.recipe.create({
      data: {
        title: `E2E Detail Private ${runId}`,
        description: 'Only the owner should see this',
        prep_time_minutes: 60,
        servings: 4,
        is_public: false,
        author_id: ownerId,
        rating: 5,
        category: 'DESSERT',
        ingredients: ['sugar', 'flour', 'eggs'],
        steps: ['mix ingredients', 'bake for 30 minutes', 'cool and serve'],
        cover_image_key: `recipes/e2e-detail-private-${runId}.jpg`,
      },
    });
    ownerPrivateRecipeId = privateRecipe.id;

    ownerToken = await jwtService.signAsync({
      email: `${ownerId}@example.com`,
      sub: ownerId,
    });
    otherUserToken = await jwtService.signAsync({
      email: `${otherUserId}@example.com`,
      sub: otherUserId,
    });
  });

  afterAll(async () => {
    await prisma.recipe.deleteMany({
      where: { id: { in: [publicRecipeId, ownerPrivateRecipeId] } },
    });
    await prisma.users.deleteMany({
      where: { id: { in: [ownerId, otherUserId] } },
    });
    await app.close();
  });

  it('returns 200 with full details for a public recipe as a guest', async () => {
    const response = await request(app.getHttpServer())
      .get(`/recipes/${publicRecipeId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: publicRecipeId,
      isPublic: true,
      ingredients: ['bread', 'butter'],
      steps: ['spread butter on bread', 'eat'],
      coverImageKey: `recipes/e2e-detail-public-${runId}.jpg`,
      coverImageUrl: FAKE_URL,
    });
  });

  it('returns 200 with full details for a public recipe as an authenticated non-owner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/recipes/${publicRecipeId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .expect(200);

    expect(response.body.id).toBe(publicRecipeId);
    expect(response.body.coverImageUrl).toBe(FAKE_URL);
  });

  it('returns 200 with full details for a private recipe when requested by its owner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/recipes/${ownerPrivateRecipeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: ownerPrivateRecipeId,
      isPublic: false,
      authorId: ownerId,
      coverImageUrl: FAKE_URL,
    });
  });

  it('returns 404 (not 403) for a private recipe requested by a guest', async () => {
    await request(app.getHttpServer()).get(`/recipes/${ownerPrivateRecipeId}`).expect(404);
  });

  it('returns 404 (not 403) for a private recipe requested by a non-owner', async () => {
    await request(app.getHttpServer())
      .get(`/recipes/${ownerPrivateRecipeId}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .expect(404);
  });

  it('returns 404 for a recipe id that does not exist', async () => {
    await request(app.getHttpServer()).get(`/recipes/${randomUUID()}`).expect(404);
  });

  it('returns the same error shape for "not found" and "not accessible" (anti-enumeration)', async () => {
    const notFoundResponse = await request(app.getHttpServer())
      .get(`/recipes/${randomUUID()}`)
      .expect(404);

    const notAccessibleResponse = await request(app.getHttpServer())
      .get(`/recipes/${ownerPrivateRecipeId}`)
      .expect(404);

    expect(Object.keys(notFoundResponse.body).sort()).toEqual(
      Object.keys(notAccessibleResponse.body).sort(),
    );
  });
});
