import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesRepository } from './recipes.repository';
import { Recipe } from './recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';

describe('RecipesService', () => {
  let service: RecipesService;
  let repository: jest.Mocked<RecipesRepository>;

  const buildRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'recipe-1',
    title: 'Tomato Soup',
    description: 'A warm classic',
    prepTime: 30,
    isPublic: true,
    authorId: 'author-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    editedAt: new Date('2024-01-01T00:00:00Z'),
    rating: 4,
    category: 'soup',
    ingredients: 'tomato, salt, water',
    steps: 'boil, blend, serve',
    ...overrides,
  });

  beforeEach(async () => {
    const repositoryMock: Partial<jest.Mocked<RecipesRepository>> = {
      findVisible: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RecipesService, { provide: RecipesRepository, useValue: repositoryMock }],
    }).compile();

    service = module.get(RecipesService);
    repository = module.get(RecipesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findVisible', () => {
    it('delegates to repository.findVisible with the given filters and userId', async () => {
      const filters: RecipeQuerySearchDto = { category: 'soup' } as RecipeQuerySearchDto;
      const recipes = [buildRecipe()];
      repository.findVisible.mockResolvedValue(recipes);

      const result = await service.findVisible(filters, 'user-1');

      expect(repository.findVisible).toHaveBeenCalledWith(filters, 'user-1');
      expect(repository.findVisible).toHaveBeenCalledTimes(1);
      expect(result).toBe(recipes);
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
    it('returns a public recipe for a guest (userId = null)', async () => {
      const recipe = buildRecipe({ isPublic: true, authorId: 'author-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', null);

      expect(repository.findById).toHaveBeenCalledWith('recipe-1');
      expect(result).toBe(recipe);
    });

    it('returns a public recipe for an authenticated user who is not the owner', async () => {
      const recipe = buildRecipe({ isPublic: true, authorId: 'author-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', 'someone-else');

      expect(result).toBe(recipe);
    });

    it('returns a private recipe when the requester is the owner', async () => {
      const recipe = buildRecipe({ isPublic: false, authorId: 'owner-1' });
      repository.findById.mockResolvedValue(recipe);

      const result = await service.findOne('recipe-1', 'owner-1');

      expect(result).toBe(recipe);
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
});
