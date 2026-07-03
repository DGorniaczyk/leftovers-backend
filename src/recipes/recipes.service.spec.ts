import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesRepository } from './recipes.repository';
import { UploadService } from '../upload/upload.service';
import { Recipe, RecipeCategory } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';

describe('RecipesService', () => {
  let service: RecipesService;
  let repository: jest.Mocked<RecipesRepository>;
  let uploadService: jest.Mocked<UploadService>;

  const FAKE_PRESIGNED_URL = 'https://s3.example.com/recipes/fake-key.jpg?signature=xxx';

  const buildRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'recipe-1',
    title: 'Tomato Soup',
    description: 'A warm classic',
    prepTime: 30,
    servings: 4,
    isPublic: true,
    authorId: 'author-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    editedAt: new Date('2024-01-01T00:00:00Z'),
    rating: 0,
    category: RecipeCategory.SOUP,
    ingredients: ['2 tomatoes', '1 tsp salt'],
    steps: ['Boil tomatoes', 'Blend until smooth'],
    coverImageKey: 'recipes/fake-key.jpg',
    coverImageUrl: '',
    ...overrides,
  });

  const buildCreateRecipeInput = (
    overrides: Partial<Omit<CreateRecipeInput, 'coverImageKey'>> = {},
  ): Omit<CreateRecipeInput, 'coverImageKey'> => ({
    title: 'Tomato Soup',
    description: 'A warm classic',
    category: RecipeCategory.SOUP,
    prepTime: 30,
    servings: 4,
    ingredients: ['2 tomatoes', '1 tsp salt'],
    steps: ['Boil tomatoes', 'Blend until smooth'],
    authorId: 'author-1',
    ...overrides,
  });

  const buildMockFile = (): Express.Multer.File => ({
    fieldname: 'coverImage',
    originalname: 'soup.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-content'),
    size: 1024,
    stream: null,
    destination: '',
    filename: '',
    path: '',
  });

  beforeEach(async () => {
    const repositoryMock: Partial<jest.Mocked<RecipesRepository>> = {
      findVisible: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    const uploadServiceMock: Partial<jest.Mocked<UploadService>> = {
      upload: jest.fn().mockResolvedValue(undefined),
      getFileUrl: jest.fn().mockResolvedValue(FAKE_PRESIGNED_URL),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: RecipesRepository, useValue: repositoryMock },
        { provide: UploadService, useValue: uploadServiceMock },
      ],
    }).compile();

    service = module.get(RecipesService);
    repository = module.get(RecipesRepository);
    uploadService = module.get(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findVisible', () => {
    it('delegates to repository.findVisible with the given filters and userId', async () => {
      const filters: RecipeQuerySearchDto = {
        category: RecipeCategory.SOUP,
      } as RecipeQuerySearchDto;
      const recipes = [buildRecipe()];
      repository.findVisible.mockResolvedValue(recipes);

      const result = await service.findVisible(filters, 'user-1');

      expect(repository.findVisible).toHaveBeenCalledWith(filters, 'user-1');
      expect(repository.findVisible).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(recipes[0].id);
    });

    it('enriches each recipe with a presigned URL', async () => {
      const recipes = [buildRecipe({ coverImageKey: 'recipes/fake-key.jpg' })];
      repository.findVisible.mockResolvedValue(recipes);

      const result = await service.findVisible({} as RecipeQuerySearchDto, null);

      expect(uploadService.getFileUrl).toHaveBeenCalledWith('recipes/fake-key.jpg');
      expect(result[0].coverImageUrl).toBe(FAKE_PRESIGNED_URL);
    });

    it('passes userId = null through for guests', async () => {
      repository.findVisible.mockResolvedValue([]);

      await service.findVisible({} as RecipeQuerySearchDto, null);

      expect(repository.findVisible).toHaveBeenCalledWith({}, null);
    });

    it('returns an empty array when the repository finds nothing', async () => {
      repository.findVisible.mockResolvedValue([]);

      const result = await service.findVisible({} as RecipeQuerySearchDto, 'user-1');

      expect(result).toEqual([]);
    });

    it('propagates errors thrown by the repository', async () => {
      repository.findVisible.mockRejectedValue(new Error('db unavailable'));

      await expect(service.findVisible({} as RecipeQuerySearchDto, 'user-1')).rejects.toThrow(
        'db unavailable',
      );
    });
  });

  describe('findOne', () => {
    it('returns a public recipe with a presigned URL for a guest (userId = null)', async () => {
      const recipe = buildRecipe({ isPublic: true, authorId: 'author-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', null);

      expect(repository.findById).toHaveBeenCalledWith('recipe-1');
      expect(result.id).toBe(recipe.id);
      expect(result.coverImageUrl).toBe(FAKE_PRESIGNED_URL);
    });

    it('returns a public recipe for an authenticated user who is not the owner', async () => {
      const recipe = buildRecipe({ isPublic: true, authorId: 'author-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', 'someone-else');

      expect(result.id).toBe(recipe.id);
    });

    it('returns a private recipe when the requester is the owner', async () => {
      const recipe = buildRecipe({ isPublic: false, authorId: 'owner-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', 'owner-1');

      expect(result.id).toBe(recipe.id);
    });

    it('throws NotFoundException when the recipe does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a guest requesting a private recipe', async () => {
      const recipe = buildRecipe({ isPublic: false, authorId: 'owner-1' });
      repository.findById.mockResolvedValue(recipe);

      await expect(service.findOne('recipe-1', null)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an authenticated user who is not the owner of a private recipe', async () => {
      const recipe = buildRecipe({ isPublic: false, authorId: 'owner-1' });
      repository.findById.mockResolvedValue(recipe);

      await expect(service.findOne('recipe-1', 'someone-else')).rejects.toThrow(NotFoundException);
    });

    it('never reveals whether the recipe exists in the error (404 in both cases)', async () => {
      repository.findById.mockResolvedValueOnce(null);
      const notFoundError = await service.findOne('missing-id', 'user-1').catch((e) => e);

      const recipe = buildRecipe({ isPublic: false, authorId: 'owner-1' });
      repository.findById.mockResolvedValueOnce(recipe);
      const notAccessibleError = await service.findOne('recipe-1', 'someone-else').catch((e) => e);

      expect(notFoundError).toBeInstanceOf(NotFoundException);
      expect(notAccessibleError).toBeInstanceOf(NotFoundException);
      expect(notFoundError.getStatus()).toBe(notAccessibleError.getStatus());
    });
  });

  describe('create', () => {
    it('uploads the cover image to S3 before saving the recipe', async () => {
      const input = buildCreateRecipeInput();
      const coverImage = buildMockFile();
      repository.create.mockResolvedValue(buildRecipe());

      await service.create(input, coverImage);

      expect(uploadService.upload).toHaveBeenCalledTimes(1);
      const [key, file] = (uploadService.upload as jest.Mock).mock.calls[0];
      expect(key).toMatch(/^recipes\/.+\.jpg$/);
      expect(file).toBe(coverImage);
    });

    it('saves the recipe with the generated S3 key', async () => {
      const input = buildCreateRecipeInput();
      const coverImage = buildMockFile();
      repository.create.mockResolvedValue(buildRecipe());

      await service.create(input, coverImage);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coverImageKey: expect.stringMatching(/^recipes\/.+\.jpg$/),
        }),
      );
    });

    it('returns the created recipe with a presigned URL', async () => {
      const input = buildCreateRecipeInput();
      const coverImage = buildMockFile();
      const created = buildRecipe({ id: 'new-recipe-id' });
      repository.create.mockResolvedValue(created);

      const result = await service.create(input, coverImage);

      expect(result.id).toBe('new-recipe-id');
      expect(result.coverImageUrl).toBe(FAKE_PRESIGNED_URL);
    });

    it('passes authorId through to the repository', async () => {
      const input = buildCreateRecipeInput({ authorId: 'specific-user-id' });
      repository.create.mockResolvedValue(buildRecipe({ authorId: 'specific-user-id' }));

      await service.create(input, buildMockFile());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'specific-user-id' }),
      );
    });

    it('passes all required fields through to the repository', async () => {
      const input = buildCreateRecipeInput({
        title: 'My Recipe',
        description: 'My Description',
        category: RecipeCategory.DINNER,
        prepTime: 45,
        servings: 2,
        ingredients: ['ingredient 1', 'ingredient 2'],
        steps: ['step 1', 'step 2'],
      });
      repository.create.mockResolvedValue(buildRecipe());

      await service.create(input, buildMockFile());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Recipe',
          description: 'My Description',
          category: RecipeCategory.DINNER,
          prepTime: 45,
          servings: 2,
          ingredients: ['ingredient 1', 'ingredient 2'],
          steps: ['step 1', 'step 2'],
        }),
      );
    });

    it('propagates errors thrown by the repository', async () => {
      repository.create.mockRejectedValue(new Error('db unavailable'));

      await expect(service.create(buildCreateRecipeInput(), buildMockFile())).rejects.toThrow(
        'db unavailable',
      );
    });

    it('propagates errors thrown by the upload service', async () => {
      uploadService.upload.mockRejectedValue(new Error('S3 unavailable'));

      await expect(service.create(buildCreateRecipeInput(), buildMockFile())).rejects.toThrow(
        'S3 unavailable',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });
});
