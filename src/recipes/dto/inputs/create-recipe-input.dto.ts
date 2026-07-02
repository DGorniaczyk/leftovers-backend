import { RecipeCategory } from '../../models/recipe.model';

export class CreateRecipeInput {
  title: string;
  description: string;
  category: RecipeCategory;
  prepTime: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  authorId: string;
}
