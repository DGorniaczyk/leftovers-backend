export class Recipe {
  id: string;
  title: string;
  description: string | null;
  prepTime: number | null;
  isPublic: boolean;
  authorId: string;
  createdAt: Date;
  editedAt: Date;
  rating: number;
  category: string | null;
  ingredients: string;
  steps: string;
}
