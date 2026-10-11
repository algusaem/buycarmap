/*
  Warnings:

  - You are about to drop the `rate_limits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `search_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `two_factor_recovery_codes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "rate_limits" DROP CONSTRAINT "rate_limits_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "rate_limits" DROP CONSTRAINT "rate_limits_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "search_histories" DROP CONSTRAINT "search_histories_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "search_histories" DROP CONSTRAINT "search_histories_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "search_histories" DROP CONSTRAINT "search_histories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "two_factor_recovery_codes_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "two_factor_recovery_codes_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "two_factor_recovery_codes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_updated_by_id_fkey";

-- DropTable
DROP TABLE "rate_limits";

-- DropTable
DROP TABLE "search_histories";

-- DropTable
DROP TABLE "two_factor_recovery_codes";

-- DropTable
DROP TABLE "verification_tokens";
