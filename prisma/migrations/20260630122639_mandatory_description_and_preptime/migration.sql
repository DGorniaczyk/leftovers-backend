/*
  Warnings:

  - Made the column `description` on table `recipe` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prep_time_minutes` on table `recipe` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "recipe" ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "prep_time_minutes" SET NOT NULL;
