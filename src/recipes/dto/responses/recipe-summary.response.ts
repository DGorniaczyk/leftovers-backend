import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Recipe } from '../../models/recipe.model';

export class RecipeSummaryResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  prepTime: number | null;

  static from(recipe: Recipe): RecipeSummaryResponse {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      prepTime: recipe.prepTime,
    };
  }
}
