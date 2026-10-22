// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), status: text('status').notNull().default('draft'),
  data: text('data').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const imports = sqliteTable('imports', {
  id: text('id').primaryKey(), fingerprint: text('fingerprint').notNull().unique(), gameId: text('game_id').notNull(),
  data: text('data').notNull(), state: text('state').notNull().default('active'), createdAt: text('created_at').notNull(),
});
export const admins = sqliteTable('admins', { id: text('id').primaryKey(), email: text('email'), createdAt: text('created_at').notNull() });
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), key: text('key').notNull(), uploadId: text('upload_id').notNull(),
  owner: text('owner').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull(),
});
