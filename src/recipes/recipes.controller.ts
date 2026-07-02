import { Controller, Get, Query, Request, UseGuards, Param } from '@nestjs/common';
import {
  ApiOkResponse,
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
import { User as AuthenticatedUser } from '../auth/interface/user.interface';

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
}
