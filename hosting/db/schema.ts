// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const engagementEvents = sqliteTable('engagement_events', {
  eventKey: text('event_key').primaryKey(), sourceId: text('source_id').notNull(), actor: text('actor').notNull(), kind: text('kind').notNull(), recordedAt: text('recorded_at').notNull(),
}, t => [index('engagement_source_time').on(t.sourceId,t.recordedAt), index('engagement_actor_time').on(t.actor,t.recordedAt)]);
export const engagementLikes = sqliteTable('engagement_likes', {
  sourceId: text('source_id').notNull(), actor: text('actor').notNull(), active: integer('active').notNull().default(0), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({columns:[t.sourceId,t.actor]})]);
