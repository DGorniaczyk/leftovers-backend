/*
  Warnings:

  - You are about to drop the column `cover_image_url` on the `recipe` table. All the data in the column will be lost.
  - Added the required column `cover_image_key` to the `recipe` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recipe" DROP COLUMN "cover_image_url",
ADD COLUMN     "cover_image_key" TEXT NOT NULL;
