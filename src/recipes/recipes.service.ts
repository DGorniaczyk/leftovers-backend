import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { RecipesRepository } from './recipes.repository';
import { Recipe } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';
import { UploadService } from '../upload/upload.service';
import { RecipeRatingsRepository } from './recipe-rating.repository';
import { SavedRecipesRepository } from './saved-recipe.repository';
import { RecipeRating } from './models/recipe-rating.model';
import { SavedRecipe } from './models/saved-recipe.model';

@Injectable()
export class RecipesService {
  constructor(
    private readonly recipesRepository: RecipesRepository,
    private readonly recipeRatingsRepository: RecipeRatingsRepository,
    private readonly savedRecipesRepository: SavedRecipesRepository,
    private readonly uploadService: UploadService,
  ) {}

  async findVisible(filters: RecipeQuerySearchDto, userId: string | null): Promise<Recipe[]> {
    const recipes = await this.recipesRepository.findVisible(filters, userId);
    return this.withPresignedUrls(recipes);
  }

  async findOne(id: string, userId: string | null): Promise<Recipe> {
    const recipe = await this.recipesRepository.findById(id);
    const hasAccess = recipe && (recipe.isPublic || recipe.authorId === userId);
    if (!hasAccess) {
      throw new NotFoundException('Recipe not found');
    }
    return this.withPresignedUrl(recipe);
  }

  async rateRecipe(recipeId: string, userId: string, rating: number): Promise<RecipeRating> {
    const recipe = await this.recipesRepository.findById(recipeId);
    const hasAccess = recipe && (recipe.isPublic || recipe.authorId === userId);
    if (!hasAccess) {
      throw new NotFoundException('Recipe not found');
    }

    return this.recipeRatingsRepository.upsert({ userId, recipeId, rating });
  }

  async saveRecipe(recipeId: string, userId: string): Promise<SavedRecipe> {
    const recipe = await this.recipesRepository.findById(recipeId);
    const hasAccess = recipe && (recipe.isPublic || recipe.authorId === userId);
    if (!hasAccess) {
      throw new NotFoundException('Recipe not found');
    }

    return this.savedRecipesRepository.save(userId, recipeId);
  }

  async unsaveRecipe(recipeId: string, userId: string): Promise<void> {
    await this.savedRecipesRepository.unsave(userId, recipeId);
  }

  async getSavedRecipes(userId: string): Promise<Recipe[]> {
    const saved = await this.savedRecipesRepository.findByUser(userId);
    const recipes = await Promise.all(
      saved.map((s) => this.recipesRepository.findById(s.recipeId)),
    );
    const validRecipes = recipes.filter((r): r is Recipe => r !== null);
    return this.withPresignedUrls(validRecipes);
  }

  async create(input: CreateRecipeInput, coverImage: Express.Multer.File): Promise<Recipe> {
    const ext = extname(coverImage.originalname);
    const key = `recipes/${randomUUID()}${ext}`;

    await this.uploadService.upload(key, coverImage);

    try {
      const recipe = await this.recipesRepository.create({ ...input, coverImageKey: key });
      return this.withPresignedUrl(recipe);
    } catch (err) {
      await this.uploadService.remove(key);
      throw err;
    }
  }

  private async withPresignedUrl(recipe: Recipe): Promise<Recipe> {
    const coverImageUrl = await this.uploadService.getFileUrl(recipe.coverImageKey);
    return { ...recipe, coverImageUrl };
  }

  private async withPresignedUrls(recipes: Recipe[]): Promise<Recipe[]> {
    return Promise.all(recipes.map((recipe) => this.withPresignedUrl(recipe)));
  }
}
