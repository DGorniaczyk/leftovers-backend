import { ApiProperty } from '@nestjs/swagger';
import { SavedRecipe } from '../../models/saved-recipe.model';

export class SavedRecipeResponse {
  @ApiProperty()
  recipeId: string;

  @ApiProperty()
  savedAt: Date;

  static from(saved: SavedRecipe): SavedRecipeResponse {
    return {
      recipeId: saved.recipeId,
      savedAt: saved.savedAt,
    };
  }
}
