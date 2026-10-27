-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('NOTE', 'RESOLUTION', 'REOPENING', 'CLOSURE', 'ESCALATION');

-- AlterEnum
ALTER TYPE "TicketEventKind" ADD VALUE 'CATEGORY_CHANGED';

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "isOther" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "kind" "CommentKind" NOT NULL DEFAULT 'NOTE';
