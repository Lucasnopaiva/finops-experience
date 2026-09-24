import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const linkedinLinks = sqliteTable('linkedin_links', {
  participantId: text('participant_id').primaryKey(),
  url: text('url').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  companyId: text('company_id'),
  company: text('company'),
  photo: text('photo').notNull(),
  present: text('present').notNull(),
});

export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const companyProfiles = sqliteTable('company_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  photo: text('photo').notNull(),
});
