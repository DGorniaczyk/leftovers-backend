import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  recipe as RecipeRow,
  recipe_category as RecipeCategoryPrisma,
} from '../generated/prisma/client';
import { Recipe, RecipeCategory } from './models/recipe.model';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { CreateRecipeInput, CreateRecipeData } from './dto/inputs/create-recipe-input.dto';

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
      conditions.push({ category: filters.category as RecipeCategoryPrisma });
    }
    if (filters.title) {
      conditions.push({ title: { contains: filters.title, mode: 'insensitive' } });
    }
    if (filters.description) {
      conditions.push({ description: { contains: filters.description, mode: 'insensitive' } });
    }
    if (filters.ingredients) {
      conditions.push({ ingredients: { has: filters.ingredients } });
    }
    if (filters.steps) {
      conditions.push({ steps: { has: filters.steps } });
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

  async create(input: CreateRecipeData): Promise<Recipe> {
    const row = await this.prisma.recipe.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category as RecipeCategoryPrisma,
        prep_time_minutes: input.prepTime,
        servings: input.servings,
        ingredients: input.ingredients,
        steps: input.steps,
        author_id: input.authorId,
        cover_image_key: input.coverImageKey,
        is_public: true,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: RecipeRow): Recipe {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      prepTime: row.prep_time_minutes,
      servings: row.servings,
      isPublic: row.is_public,
      authorId: row.author_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.category as unknown as RecipeCategory,
      ingredients: row.ingredients,
      steps: row.steps,
      coverImageKey: row.cover_image_key,
      coverImageUrl: '',
    };
  }
}
