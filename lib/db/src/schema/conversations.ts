import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
    orderId: integer("order_id"),
    type: text("type").notNull().default("customer_seller"),
    status: text("status").notNull().default("active"),
    muted: boolean("muted").notNull().default(false),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_conversations_customer_id").on(t.customerId),
    index("idx_conversations_seller_id").on(t.sellerId),
    index("idx_conversations_last_message").on(t.sellerId, t.lastMessageAt),
    index("idx_conversations_type").on(t.type),
    index("idx_conversations_updated_at").on(t.lastMessageAt),
  ]
);

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    attachmentId: integer("attachment_id"),
    readAt: timestamp("read_at"),
    deletedAt: timestamp("deleted_at"),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_messages_conversation_id").on(t.conversationId),
    index("idx_messages_sender_id").on(t.senderId),
    index("idx_messages_conv_created").on(t.conversationId, t.createdAt),
    index("idx_messages_created_at").on(t.createdAt),
  ]
);

export const messageAttachmentsTable = pgTable(
  "message_attachments",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_msg_attachments_conv_id").on(t.conversationId),
  ]
);

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type MessageAttachment = typeof messageAttachmentsTable.$inferSelect;
