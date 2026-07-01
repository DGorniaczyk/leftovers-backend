import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsIn,
  IsEnum,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { RecipeCategory, ALLOWED_SERVINGS } from '../../models/recipe.model';

export class CreateRecipeDto {
  @ApiProperty({ maxLength: 100, example: 'Tomato Soup' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ maxLength: 200, example: 'A warm, comforting classic.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({ enum: RecipeCategory, example: RecipeCategory.SOUP })
  @IsEnum(RecipeCategory)
  category: RecipeCategory;

  @ApiProperty({ minimum: 1, maximum: 600, example: 30, description: 'Minutes' })
  @IsInt()
  @Min(1)
  @Max(600)
  prepTime: number;

  @ApiProperty({ enum: ALLOWED_SERVINGS, example: 4 })
  @IsInt()
  @IsIn(ALLOWED_SERVINGS as unknown as number[])
  servings: number;

  @ApiProperty({ type: [String], example: ['2 tomatoes', '1 tsp salt'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ingredients: string[];

  @ApiProperty({ type: [String], example: ['Boil tomatoes', 'Blend until smooth'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps: string[];
}
