import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
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
  ApiBody,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { RecipesService } from './recipes.service';
import { RecipeQuerySearchDto } from './dto/recipe-query-search.dto';
import { RecipeSummaryResponse } from './dto/responses/recipe-summary.response';
import { RecipeResponse } from './dto/responses/recipe.response';
import { CreateRecipeDto } from './dto/requests/create-recipe.dto';
import { CreateRecipeInput } from './dto/inputs/create-recipe-input.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-auth-guard';
import { User as AuthenticatedUser } from '../auth/interface/user.interface';
import { RecipeCategory } from './models/recipe.model';

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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'title',
        'description',
        'category',
        'prepTime',
        'servings',
        'ingredients',
        'steps',
        'coverImage',
      ],
      properties: {
        title: { type: 'string', maxLength: 100 },
        description: { type: 'string', maxLength: 200 },
        category: { type: 'string', enum: Object.values(RecipeCategory) },
        prepTime: { type: 'integer', minimum: 1, maximum: 600 },
        servings: { type: 'integer', enum: [1, 2, 4, 6, 8] },
        ingredients: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } },
        coverImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, type: RecipeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('coverImage'))
  @Post()
  async create(
    @Body() dto: CreateRecipeDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
      }),
    )
    coverImage: Express.Multer.File,
    @Request() req: { user: AuthenticatedUser },
  ): Promise<RecipeResponse> {
    const input: Omit<CreateRecipeInput, 'coverImageKey'> = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prepTime: dto.prepTime,
      servings: dto.servings,
      ingredients: dto.ingredients,
      steps: dto.steps,
      authorId: req.user.userId,
    };

    const recipe = await this.recipesService.create(input, coverImage);
    return RecipeResponse.from(recipe);
  }
}
