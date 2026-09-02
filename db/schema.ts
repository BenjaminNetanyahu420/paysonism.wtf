import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const chatMessages = sqliteTable(
	"chat_messages",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		username: text("username").notNull(),
		message: text("message").notNull(),
		senderHash: text("sender_hash").notNull(),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	},
	(table) => [index("idx_chat_messages_sender_id").on(table.senderHash, table.id)]
);

export const forumUsers = sqliteTable(
	"forum_users",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		username: text("username").notNull().unique(),
		usernameKey: text("username_key").notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		isSuspended: integer("is_suspended", { mode: "boolean" }).notNull().default(false),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	},
	(table) => [index("idx_forum_users_username_key").on(table.usernameKey)]
);

export const forumSessions = sqliteTable(
	"forum_sessions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: integer("user_id").notNull().references(() => forumUsers.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull().unique(),
		expiresAt: text("expires_at").notNull(),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	},
	(table) => [index("idx_forum_sessions_token_expiry").on(table.tokenHash, table.expiresAt)]
);

export const forumCategories = sqliteTable(
	"forum_categories",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		slug: text("slug").notNull().unique(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		position: integer("position").notNull(),
		isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	}
);

export const forumTopics = sqliteTable(
	"forum_topics",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		categoryId: integer("category_id").notNull().references(() => forumCategories.id),
		authorId: integer("author_id").notNull().references(() => forumUsers.id),
		title: text("title").notNull(),
		body: text("body").notNull(),
		isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
		isSticky: integer("is_sticky", { mode: "boolean" }).notNull().default(false),
		isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
		lastActivityAt: text("last_activity_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
		updatedAt: text("updated_at")
	},
	(table) => [index("idx_forum_topics_category_activity").on(table.categoryId, table.isHidden, table.isSticky, table.lastActivityAt)]
);

export const forumReplies = sqliteTable(
	"forum_replies",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		topicId: integer("topic_id").notNull().references(() => forumTopics.id, { onDelete: "cascade" }),
		authorId: integer("author_id").notNull().references(() => forumUsers.id),
		body: text("body").notNull(),
		isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
		updatedAt: text("updated_at")
	},
	(table) => [index("idx_forum_replies_topic_id").on(table.topicId, table.id)]
);

export const forumAttachments = sqliteTable(
	"forum_attachments",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		uploaderId: integer("uploader_id").notNull().references(() => forumUsers.id),
		url: text("url").notNull().unique(),
		filename: text("filename").notNull(),
		byteSize: integer("byte_size").notNull().default(0),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	},
	(table) => [index("idx_forum_attachments_uploader_id").on(table.uploaderId, table.id)]
);

export const forumReports = sqliteTable(
	"forum_reports",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		reporterId: integer("reporter_id").notNull().references(() => forumUsers.id),
		targetType: text("target_type").notNull(),
		targetId: integer("target_id").notNull(),
		reason: text("reason").notNull(),
		status: text("status").notNull().default("open"),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	},
	(table) => [index("idx_forum_reports_status_id").on(table.status, table.id)]
);

export const forumModerationEvents = sqliteTable(
	"forum_moderation_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ownerId: integer("owner_id").notNull().references(() => forumUsers.id),
		targetType: text("target_type").notNull(),
		targetId: integer("target_id").notNull(),
		action: text("action").notNull(),
		details: text("details").notNull().default(""),
		createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
	}
);

export const forumRateLimits = sqliteTable(
	"forum_rate_limits",
	{
		key: text("key").primaryKey(),
		count: integer("count").notNull(),
		windowStartedAt: text("window_started_at").notNull()
	}
);
