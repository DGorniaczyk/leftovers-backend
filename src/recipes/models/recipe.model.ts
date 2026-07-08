export enum RecipeCategory {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  DESSERT = 'DESSERT',
  SNACK = 'SNACK',
  APPETIZER = 'APPETIZER',
  SOUP = 'SOUP',
  SALAD = 'SALAD',
  BEVERAGE = 'BEVERAGE',
  OTHER = 'OTHER',
}

export const ALLOWED_SERVINGS = [1, 2, 4, 6, 8] as const;
export type Servings = (typeof ALLOWED_SERVINGS)[number];

export class Recipe {
  id: string;
  title: string;
  description: string;
  prepTime: number;
  servings: number;
  isPublic: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  rating: number;
  category: RecipeCategory;
  ingredients: string[];
  steps: string[];
  coverImageKey: string;
  coverImageUrl: string;
}
