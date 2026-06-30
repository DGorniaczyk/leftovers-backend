import { Injectable } from '@nestjs/common';
import { RecipesRepository } from './recipes.repository';
import { Recipe } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly recipesRepository: RecipesRepository) {}

  async findVisible(filters: RecipeQuerySearchDto, userId: string | null): Promise<Recipe[]> {
    return this.recipesRepository.findVisible(filters, userId);
  }
}
