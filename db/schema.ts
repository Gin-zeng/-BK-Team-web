// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), status: text('status').notNull().default('draft'),
  data: text('data').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const imports = sqliteTable('imports', {
  id: text('id').primaryKey(), fingerprint: text('fingerprint').notNull().unique(), gameId: text('game_id').notNull(),
  data: text('data').notNull(), state: text('state').notNull().default('active'), createdAt: text('created_at').notNull(),
});
export const admins = sqliteTable('admins', { id: text('id').primaryKey(), email: text('email'), role: text('role').notNull().default('admin'), createdAt: text('created_at').notNull() });
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), key: text('key').notNull(), uploadId: text('upload_id').notNull(),
  owner: text('owner').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull(),
});
export const emailUsers=sqliteTable('email_users',{id:text('id').primaryKey(),email:text('email').notNull().unique(),createdAt:text('created_at').notNull()});
export const emailSessions=sqliteTable('email_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull()});
export const emailCodes=sqliteTable('email_codes',{id:text('id').primaryKey(),email:text('email').notNull(),codeHash:text('code_hash').notNull(),expiresAt:integer('expires_at').notNull(),attempts:integer('attempts').notNull().default(0),usedAt:integer('used_at'),createdAt:integer('created_at').notNull()});
export const authBootstrap=sqliteTable('auth_bootstrap',{id:text('id').primaryKey(),userId:text('user_id').notNull()});
export const authLimits=sqliteTable('auth_limits',{key:text('key').primaryKey(),windowStart:integer('window_start').notNull(),count:integer('count').notNull()});
export const ratings=sqliteTable('ratings',{id:text('id').primaryKey(),playerId:text('player_id').notNull(),dims:text('dims').notNull(),createdAt:text('created_at').notNull()},(t)=>[index('ratings_player_idx').on(t.playerId)]);
