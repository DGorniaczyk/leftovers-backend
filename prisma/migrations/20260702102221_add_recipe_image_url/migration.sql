/*
  Warnings:

  - Added the required column `cover_image_url` to the `recipe` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "cover_image_url" TEXT NOT NULL;
