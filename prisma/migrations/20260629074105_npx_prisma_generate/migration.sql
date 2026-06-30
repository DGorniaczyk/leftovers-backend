/*
  Warnings:

  - You are about to drop the column `isPublic` on the `recipe` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "recipe" DROP COLUMN "isPublic",
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true;
