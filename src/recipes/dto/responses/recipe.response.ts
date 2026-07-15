import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Recipe, RecipeCategory } from '../../models/recipe.model';

export class RecipeResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  prepTime: number;

  @ApiProperty()
  servings: number;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  rating: number;

  @ApiProperty({ enum: RecipeCategory })
  category: RecipeCategory;

  @ApiProperty({ type: [String] })
  ingredients: string[];

  @ApiProperty({ type: [String] })
  steps: string[];

  @ApiProperty({ description: 'Presigned URL to access the cover image (valid 1h)' })
  coverImageUrl: string;

  static from(recipe: Recipe): RecipeResponse {
    return { ...recipe };
  }
}
