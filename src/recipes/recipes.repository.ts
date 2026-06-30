import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, recipe as RecipeRow } from '../generated/prisma/client';
import { Recipe } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';

@Injectable()
export class RecipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVisible(filters: RecipeQuerySearchDto, userId: string | null): Promise<Recipe[]> {
    const visibilityCondition: Prisma.recipeWhereInput = userId
      ? { OR: [{ is_public: true }, { author_id: userId }] }
      : { is_public: true };

    const where: Prisma.recipeWhereInput = {
      AND: [visibilityCondition, ...this.buildFilterConditions(filters)],
    };

    const rows = await this.prisma.recipe.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return rows.map((row) => this.toDomain(row));
  }

  private buildFilterConditions(filters: RecipeQuerySearchDto): Prisma.recipeWhereInput[] {
    const conditions: Prisma.recipeWhereInput[] = [];

    if (filters.category) {
      conditions.push({ category: filters.category });
    }
    if (filters.rating !== undefined) {
      conditions.push({ rating: { gte: filters.rating } });
    }
    if (filters.title) {
      conditions.push({ title: { contains: filters.title, mode: 'insensitive' } });
    }
    if (filters.description) {
      conditions.push({ description: { contains: filters.description, mode: 'insensitive' } });
    }
    if (filters.ingredients) {
      conditions.push({ ingredients: { contains: filters.ingredients, mode: 'insensitive' } });
    }
    if (filters.steps) {
      conditions.push({ steps: { contains: filters.steps, mode: 'insensitive' } });
    }
    if (filters.startDate) {
      conditions.push({ created_at: { gte: filters.startDate } });
    }
    if (filters.endDate) {
      conditions.push({ created_at: { lte: filters.endDate } });
    }

    return conditions;
  }

  async findById(id: string): Promise<Recipe | null> {
    const row = await this.prisma.recipe.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: RecipeRow): Recipe {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      prepTime: row.prep_time_minutes,
      isPublic: row.is_public,
      authorId: row.author_id,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      rating: row.rating,
      category: row.category,
      ingredients: row.ingredients,
      steps: row.steps,
    };
  }
}
