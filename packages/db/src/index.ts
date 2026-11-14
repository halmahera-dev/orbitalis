import { neon } from "@neondatabase/serverless";
import { env } from "@repo/env/server";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function createDb() {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

type Db = ReturnType<typeof createDb>;

let cachedDb: Db | undefined;

export function getDb() {
  if (!cachedDb) {
    cachedDb = createDb();
  }
  return cachedDb;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
