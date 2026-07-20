import { Module } from '@nestjs/common';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { RecipesRepository } from './recipes.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { RecipeRatingsRepository } from './recipe-rating.repository';
import { SavedRecipesRepository } from './saved-recipe.repository';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [RecipesController],
  providers: [RecipesService, RecipesRepository, RecipeRatingsRepository, SavedRecipesRepository],
})
export class RecipesModule {}
