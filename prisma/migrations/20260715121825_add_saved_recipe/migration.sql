-- CreateTable
CREATE TABLE "saved_recipe" (
    "user_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_recipe_pkey" PRIMARY KEY ("user_id","recipe_id")
);

-- AddForeignKey
ALTER TABLE "saved_recipe" ADD CONSTRAINT "saved_recipe_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_recipe" ADD CONSTRAINT "saved_recipe_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
