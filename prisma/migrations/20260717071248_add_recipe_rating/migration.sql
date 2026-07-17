/*
  Warnings:

  - You are about to drop the column `rating` on the `recipe` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "recipe" DROP COLUMN "rating";

-- CreateTable
CREATE TABLE "recipe_rating" (
    "user_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_rating_pkey" PRIMARY KEY ("user_id","recipe_id")
);

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
