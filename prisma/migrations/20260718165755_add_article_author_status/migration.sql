-- CreateEnum
CREATE TYPE "ArticleAuthorStatus" AS ENUM ('pending', 'approved', 'suspended');

-- AlterTable
ALTER TABLE "Tipster" ADD COLUMN     "articleAuthorStatus" "ArticleAuthorStatus" NOT NULL DEFAULT 'pending';
