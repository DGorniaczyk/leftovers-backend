export class RecipeRating {
  userId: string;
  recipeId: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateRecipeRatingInput {
  userId: string;
  recipeId: string;
  rating: number;
}
