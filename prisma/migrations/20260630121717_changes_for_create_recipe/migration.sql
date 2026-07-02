/*
  Warnings:

  - You are about to drop the column `edited_at` on the `recipe` table. All the data in the column will be lost.
  - The `ingredients` column on the `recipe` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `steps` column on the `recipe` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updated_at` to the `recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `recipe` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "recipe_category" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'SNACK', 'APPETIZER', 'SOUP', 'SALAD', 'BEVERAGE', 'OTHER');

-- AlterTable
ALTER TABLE "recipe" DROP COLUMN "edited_at",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "recipe_category" NOT NULL,
DROP COLUMN "ingredients",
ADD COLUMN     "ingredients" TEXT[],
DROP COLUMN "steps",
ADD COLUMN     "steps" TEXT[];
