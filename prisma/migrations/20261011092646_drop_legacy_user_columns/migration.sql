/*
  Warnings:

  - You are about to drop the column `email_verified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password_changed_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `two_factor_last_step` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `two_factor_secret` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "email_verified",
DROP COLUMN "password",
DROP COLUMN "password_changed_at",
DROP COLUMN "two_factor_last_step",
DROP COLUMN "two_factor_secret";
