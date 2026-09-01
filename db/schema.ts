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
