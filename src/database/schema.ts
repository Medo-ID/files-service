import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ENUMS
export const fileTypes = pgEnum("file_types", ["file", "folder"]);
export const fileStatus = pgEnum("file_status", ["pending", "completed"]);
export const uploadStatus = pgEnum("upload_status", [
  "initiated",
  "uploading",
  "completed",
  "aborted",
]);

// TABLES
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => files.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    type: fileTypes().notNull(),
    mimeType: text("mime_type"),
    size: bigint("size", { mode: "number" }).default(0).notNull(),
    status: fileStatus().notNull().default("pending"),
    storageKey: text("storage_key"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.ownerId, t.parentId, t.name)],
);

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .references(() => files.id, { onDelete: "cascade" })
    .notNull(),
  ownerId: uuid("owner_id").notNull(),
  status: uploadStatus().notNull().default("initiated"),
  totalSize: bigint("total_size", { mode: "number" }).notNull(),
  uploadedSize: bigint("uploaded_size", { mode: "number" })
    .default(0)
    .notNull(),
  multipartUploadId: text("multipart_upload_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// RELATIONS
export const fileRelations = relations(files, ({ one, many }) => ({
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: "folder",
  }),
  files: many(files, {
    relationName: "folder",
  }),
  uploads: many(uploads),
}));

export const uploadRelations = relations(uploads, ({ one }) => ({
  file: one(files, {
    fields: [uploads.fileId],
    references: [files.id],
  }),
}));

// TYPES
export type NewFile = typeof files.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
