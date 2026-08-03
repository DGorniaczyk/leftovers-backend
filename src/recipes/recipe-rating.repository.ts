import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeRating, CreateRecipeRatingInput } from './models/recipe-rating.model';

@Injectable()
export class RecipeRatingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: CreateRecipeRatingInput): Promise<RecipeRating> {
    const row = await this.prisma.recipe_rating.upsert({
      where: {
        user_id_recipe_id: {
          user_id: input.userId,
          recipe_id: input.recipeId,
        },
      },
      create: {
        user_id: input.userId,
        recipe_id: input.recipeId,
        rating: input.rating,
      },
      update: {
        rating: input.rating,
      },
    });
    return this.toDomain(row);
  }

  async getAverageRating(recipeId: string): Promise<{ average: number | null; count: number }> {
    const result = await this.prisma.recipe_rating.aggregate({
      where: { recipe_id: recipeId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return {
      average: result._avg.rating,
      count: result._count.rating,
    };
  }

  async findByUserAndRecipe(userId: string, recipeId: string): Promise<RecipeRating | null> {
    const row = await this.prisma.recipe_rating.findUnique({
      where: { user_id_recipe_id: { user_id: userId, recipe_id: recipeId } },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: any): RecipeRating {
    return {
      userId: row.user_id,
      recipeId: row.recipe_id,
      rating: row.rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
