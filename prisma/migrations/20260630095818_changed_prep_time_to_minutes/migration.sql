/*
  Warnings:

  - You are about to drop the column `prep_time` on the `recipe` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "recipe" DROP COLUMN "prep_time",
ADD COLUMN     "prep_time_minutes" INTEGER;
