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

  @ApiPropertyOptional({ nullable: true })
  averageRating: number | null;

  @ApiProperty()
  ratingsCount: number;

  @ApiProperty({ description: 'Presigned URL to access the cover image (valid 1h)' })
  coverImageUrl: string;

  static from(recipe: Recipe): RecipeSummaryResponse {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      averageRating: recipe.averageRating,
      ratingsCount: recipe.ratingsCount,
      prepTime: recipe.prepTime,
      coverImageUrl: recipe.coverImageUrl,
    };
  }
}
