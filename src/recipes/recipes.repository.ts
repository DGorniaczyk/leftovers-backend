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
      include: {
        _count: { select: { ratings: true } },
        ratings: { select: { rating: true } },
      },
    });

    const withRating = rows.map((row) => this.toDomainWithRating(row));

    let result = withRating;

    if (filters.rating !== undefined && filters.rating !== null) {
      result = result.filter((r) => (r.averageRating ?? 0) >= filters.rating!);
    }

    const sortBy = filters.sortBy ?? 'date';
    const sortDir: 'asc' | 'desc' = filters.sortDirection ?? 'desc';

    if (sortBy === 'rating') {
      result = result.sort((a, b) => {
        const aVal = a.averageRating ?? 0;
        const bVal = b.averageRating ?? 0;
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      });
    } else {
      result = result.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortDir === 'desc' ? bTime - aTime : aTime - bTime;
      });
    }

    return result;
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
    const row = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        _count: { select: { ratings: true } },
        ratings: { select: { rating: true } },
      },
    });
    return row ? this.toDomainWithRating(row) : null;
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

    return {
      ...this.toDomain(row),
      averageRating: null,
      ratingsCount: 0,
    };
  }

  private toDomainWithRating(
    row: RecipeRow & {
      ratings: { rating: number }[];
      _count: { ratings: number };
    },
  ): Recipe {
    const ratingsCount = row._count.ratings;
    const averageRating =
      ratingsCount > 0 ? row.ratings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount : null;

    return {
      ...this.toDomain(row),
      averageRating,
      ratingsCount,
    };
  }

  private toDomain(row: RecipeRow): Omit<Recipe, 'averageRating' | 'ratingsCount'> {
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
