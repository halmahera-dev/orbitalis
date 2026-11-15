import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

export const migrationsFolder = new URL("./migrations", import.meta.url).pathname;

if (import.meta.main) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = drizzle(databaseUrl);
  await migrate(db, { migrationsFolder });
  await db.$client.close();
  console.log("Migrations applied.");
}
