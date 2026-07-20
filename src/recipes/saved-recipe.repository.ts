import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SavedRecipe } from './models/saved-recipe.model';

@Injectable()
export class SavedRecipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, recipeId: string): Promise<SavedRecipe> {
    const row = await this.prisma.saved_recipe.upsert({
      where: { user_id_recipe_id: { user_id: userId, recipe_id: recipeId } },
      create: { user_id: userId, recipe_id: recipeId },
      update: {},
    });
    return this.toDomain(row);
  }

  async unsave(userId: string, recipeId: string): Promise<void> {
    await this.prisma.saved_recipe.deleteMany({
      where: { user_id: userId, recipe_id: recipeId },
    });
  }

  async findByUser(userId: string): Promise<SavedRecipe[]> {
    const rows = await this.prisma.saved_recipe.findMany({
      where: { user_id: userId },
      orderBy: { saved_at: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async isSaved(userId: string, recipeId: string): Promise<boolean> {
    const row = await this.prisma.saved_recipe.findUnique({
      where: { user_id_recipe_id: { user_id: userId, recipe_id: recipeId } },
    });
    return !!row;
  }

  private toDomain(row: any): SavedRecipe {
    return {
      userId: row.user_id,
      recipeId: row.recipe_id,
      savedAt: row.saved_at,
    };
  }
}
