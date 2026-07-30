import { PrismaClient } from '@prisma/client';

// Single shared instance — re-creating PrismaClient per request would exhaust Postgres
// connections under load.
export const prisma = new PrismaClient();
