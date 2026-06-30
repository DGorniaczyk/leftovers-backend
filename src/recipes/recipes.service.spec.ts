import { Test, TestingModule } from '@nestjs/testing';
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
