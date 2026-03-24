import {
  pgTable, text, boolean, timestamp, uuid, jsonb,
} from 'drizzle-orm/pg-core';
import type { WorkflowEntry, LegacyWorkflowConfig } from '@/lib/types';

export const users = pgTable('users', {
  id:               text('id').primaryKey(),           // GitHub user ID as string
  username:         text('username').notNull(),
  avatar_url:       text('avatar_url'),
  github_token_enc: text('github_token_enc').notNull(),
  created_at:       timestamp('created_at').defaultNow(),
});

export const spaces = pgTable('spaces', {
  id:              uuid('id').primaryKey().defaultRandom(),
  owner_id:        text('owner_id').notNull()
                     .references(() => users.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  repo_full_name:  text('repo_full_name').notNull(),
  workflow_config: jsonb('workflow_config')
                     .notNull()
                     .$type<WorkflowEntry[] | LegacyWorkflowConfig>(),
  share_token:     uuid('share_token').notNull().unique().defaultRandom(),
  share_enabled:   boolean('share_enabled').notNull().default(false),
  created_at:      timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
