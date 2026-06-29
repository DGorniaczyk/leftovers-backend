import { Injectable } from '@nestjs/common';
import { RecipesRepository } from './recipes.respository';

@Injectable()
export class RecipesService {
  constructor(private readonly recipes: RecipesRepository) {}
}
