import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const inspector = pgTable("inspector", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
