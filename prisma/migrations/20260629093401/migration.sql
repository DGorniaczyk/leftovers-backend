/*
  Warnings:

  - You are about to drop the column `token` on the `signup_requests` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "signup_requests_token_key";

-- AlterTable
ALTER TABLE "signup_requests" DROP COLUMN "token";
