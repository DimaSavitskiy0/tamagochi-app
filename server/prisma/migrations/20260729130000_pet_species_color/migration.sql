-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('cat', 'dog', 'rabbit', 'hamster', 'bird', 'fish', 'other');

-- AlterTable
ALTER TABLE "pets" ADD COLUMN "species" "PetSpecies" NOT NULL DEFAULT 'cat';
ALTER TABLE "pets" DROP COLUMN "avatar_url";
