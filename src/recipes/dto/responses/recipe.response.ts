import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Recipe } from '../../models/recipe.model';

export class RecipeResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  prepTime: number | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  editedAt: Date;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  category: string | null;

  @ApiProperty()
  ingredients: string;

  @ApiProperty()
  steps: string;

  static from(recipe: Recipe): RecipeResponse {
    return { ...recipe };
  }
}
