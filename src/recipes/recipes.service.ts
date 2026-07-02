import { Injectable, NotFoundException } from '@nestjs/common';
import { RecipesRepository } from './recipes.repository';
import { Recipe } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly recipesRepository: RecipesRepository) {}

  async findVisible(filters: RecipeQuerySearchDto, userId: string | null): Promise<Recipe[]> {
    return this.recipesRepository.findVisible(filters, userId);
  }

  async findOne(id: string, userId: string | null): Promise<Recipe> {
    const recipe = await this.recipesRepository.findById(id);

    const hasAccess = recipe && (recipe.isPublic || recipe.authorId === userId);

    if (!hasAccess) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

  async create(input: CreateRecipeInput): Promise<Recipe> {
    return this.recipesRepository.create(input);
  }
}
