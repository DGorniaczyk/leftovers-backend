import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConsumes,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { RecipesService } from './recipes.service';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { RecipeSummaryResponse } from './dto/responses/recipe-summary.response';
import { RecipeResponse } from './dto/responses/recipe.response';
import { CreateRecipeDto } from './dto/requests/create-recipe.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-auth-guard';
import type { User as AuthenticatedUser } from '../auth/interface/user.interface';
import { CurrentUser } from '../auth/decorators/current-user-decorator.dto';
import { RecipeCategory } from './models/recipe.model';
import { parseFileOptions } from 'src/upload/constants/parseFileOptions';
import { RateRecipeDto } from './dto/requests/rate-recipe.dto';
import { RecipeRatingResponse } from './dto/responses/recipe-rating.response';
import { SavedRecipeResponse } from './dto/responses/saved-recipe.response';

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
  @ApiExtraModels(RecipeSummaryResponse, RecipeResponse)
  @ApiOkResponse({
    description: 'List of recipes (empty array if none found)',
    isArray: true,
    schema: {
      items: {
        oneOf: [
          { $ref: '#/components/schemas/RecipeSummaryResponse' },
          { $ref: '#/components/schemas/RecipeResponse' },
        ],
      },
    },
  })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: RecipeQuerySearchDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<RecipeSummaryResponse[] | RecipeResponse[]> {
    const userId = user?.userId ?? null;

    const recipes = await this.recipesService.findVisible(query, userId);

    return query.details
      ? recipes.map((recipe) => RecipeResponse.from(recipe))
      : recipes.map((recipe) => RecipeSummaryResponse.from(recipe));
  }

  @ApiOperation({ summary: 'List available recipe categories' })
  @ApiOkResponse({ type: [String] })
  @Get('categories')
  getCategories(): string[] {
    return Object.values(RecipeCategory);
  }

  @ApiOperation({ summary: 'Rate a recipe (1-5 stars, can be updated)' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: RecipeRatingResponse })
  @ApiNotFoundResponse({ description: 'Recipe not found or not accessible' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  async rateRecipe(
    @Param('id') id: string,
    @Body() dto: RateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecipeRatingResponse> {
    const rating = await this.recipesService.rateRecipe(id, user.userId, dto.rating);
    return RecipeRatingResponse.from(rating);
  }

  @ApiOperation({ summary: 'Save a recipe to your collection' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: SavedRecipeResponse })
  @ApiNotFoundResponse({ description: 'Recipe not found or not accessible' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  async saveRecipe(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SavedRecipeResponse> {
    const saved = await this.recipesService.saveRecipe(id, user.userId);
    return SavedRecipeResponse.from(saved);
  }

  @ApiOperation({ summary: 'Remove a recipe from your saved collection' })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Recipe removed from saved' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsaveRecipe(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.recipesService.unsaveRecipe(id, user.userId);
  }

  @ApiOperation({ summary: 'Get all recipes saved by the authenticated user' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: [RecipeResponse] })
  @UseGuards(AuthGuard('jwt'))
  @Get('saved')
  async getSavedRecipes(@CurrentUser() user: AuthenticatedUser): Promise<RecipeResponse[]> {
    const recipes = await this.recipesService.getSavedRecipes(user.userId);
    return recipes.map((recipe) => RecipeResponse.from(recipe));
  }

  @ApiOperation({ summary: 'Get a single recipe by id' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: RecipeResponse })
  @ApiNotFoundResponse({ description: 'Recipe not found or not accessible' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<RecipeResponse> {
    const userId = user?.userId ?? null;

    const recipe = await this.recipesService.findOne(id, userId);

    return RecipeResponse.from(recipe);
  }

  @ApiOperation({ summary: 'Create a new recipe' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: RecipeResponse })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('coverImage'))
  @Post()
  async create(
    @Body() dto: CreateRecipeDto,
    @UploadedFile(new ParseFilePipe(parseFileOptions))
    coverImage: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecipeResponse> {
    const input: CreateRecipeInput = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prepTime: dto.prepTime,
      servings: dto.servings,
      ingredients: dto.ingredients,
      steps: dto.steps,
      authorId: user.userId,
    };

    const recipe = await this.recipesService.create(input, coverImage);
    return RecipeResponse.from(recipe);
  }
}
