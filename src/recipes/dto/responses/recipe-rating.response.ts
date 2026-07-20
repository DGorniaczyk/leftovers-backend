import { ApiProperty } from '@nestjs/swagger';
import { RecipeRating } from '../../models/recipe-rating.model';

export class RecipeRatingResponse {
  @ApiProperty()
  recipeId: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  updatedAt: Date;

  static from(rating: RecipeRating): RecipeRatingResponse {
    return {
      recipeId: rating.recipeId,
      rating: rating.rating,
      updatedAt: rating.updatedAt,
    };
  }
}
