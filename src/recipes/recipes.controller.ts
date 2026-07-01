import { Controller, Get, Query, Request, UseGuards, Param, Post, Body } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiResponse,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { RecipesService } from './recipes.service';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { RecipeSummaryResponse } from './dto/responses/recipe-summary.response';
import { RecipeResponse } from './dto/responses/recipe.response';
import { OptionalJwtAuthGuard } from '../auth/optional-auth-guard';
import { AuthGuard } from '@nestjs/passport';
import { User as AuthenticatedUser } from '../auth/interface/user.interface';
import { CreateRecipeDto } from './dto/requests/create-recipe.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @ApiOperation({
    summary: 'List recipes',
    description:
      'Returns public recipes. Authenticated users also receive their own private recipes.',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'details',
    required: false,
    type: Boolean,
    description: 'If true, return full recipe details; otherwise return summary fields only.',
  })
  @ApiOkResponse({
    description: 'List of recipes (empty array if none found)',
    schema: {
      oneOf: [
        { type: 'array', items: { $ref: '#/components/schemas/RecipeSummaryResponse' } },
        { type: 'array', items: { $ref: '#/components/schemas/RecipeResponse' } },
      ],
    },
  })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: RecipeQuerySearchDto,
    @Request() req: { user: AuthenticatedUser | null },
  ): Promise<RecipeSummaryResponse[] | RecipeResponse[]> {
    const userId = req.user?.userId ?? null;

    const recipes = await this.recipesService.findVisible(query, userId);

    return query.details
      ? recipes.map((recipe) => RecipeResponse.from(recipe))
      : recipes.map((recipe) => RecipeSummaryResponse.from(recipe));
  }

  @ApiOperation({ summary: 'Get a single recipe by id' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: RecipeResponse })
  @ApiNotFoundResponse({ description: 'Recipe not found or not accessible' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser | null },
  ): Promise<RecipeResponse> {
    const userId = req.user?.userId ?? null;

    const recipe = await this.recipesService.findOne(id, userId);

    return RecipeResponse.from(recipe);
  }

  @ApiOperation({ summary: 'Create a new recipe' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: RecipeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Body() dto: CreateRecipeDto,
    @Request() req: { user: AuthenticatedUser },
  ): Promise<RecipeResponse> {
    const input: CreateRecipeInput = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prepTime: dto.prepTime,
      servings: dto.servings,
      ingredients: dto.ingredients,
      steps: dto.steps,
      authorId: req.user.userId,
    };

    const recipe = await this.recipesService.create(input);

    return RecipeResponse.from(recipe);
  }
}
