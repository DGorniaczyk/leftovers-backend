import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { recipeWhereInput } from 'src/generated/prisma/models';

@Injectable()
export class RecipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Recipe>;
}
