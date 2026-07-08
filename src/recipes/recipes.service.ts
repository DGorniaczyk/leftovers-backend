import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { RecipesRepository } from './recipes.repository';
import { Recipe } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class RecipesService {
  constructor(
    private readonly recipesRepository: RecipesRepository,
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

  async create(
    input: Omit<CreateRecipeInput, 'coverImageKey'>,
    coverImage: Express.Multer.File,
  ): Promise<Recipe> {
    const ext = extname(coverImage.originalname);
    const key = `recipes/${randomUUID()}${ext}`;

    await this.uploadService.upload(key, coverImage);

    const recipe = await this.recipesRepository.create({ ...input, coverImageKey: key });

    return this.withPresignedUrl(recipe);
  }

  private async withPresignedUrl(recipe: Recipe): Promise<Recipe> {
    const coverImageUrl = await this.uploadService.getFileUrl(recipe.coverImageKey);
    return { ...recipe, coverImageUrl };
  }

  private async withPresignedUrls(recipes: Recipe[]): Promise<Recipe[]> {
    return Promise.all(recipes.map((recipe) => this.withPresignedUrl(recipe)));
  }
}
