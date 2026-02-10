import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { files, type NewFile } from "../schema";

export async function insertFileMatadata(file: NewFile) {
  const [result] = await db.insert(files).values(file).returning();
  return result?.id;
}

export async function getFileById(userId: string, fileId: string) {
  const [result] = await db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
  return result;
}

export async function getUserFiles(
  userId: string,
  type?: "file" | "folder",
  parentId?: string | null,
) {
  const conditions = [eq(files.ownerId, userId), eq(files.isDeleted, false)];

  if (type) conditions.push(eq(files.type, type));
  if (parentId !== undefined && parentId !== null)
    conditions.push(eq(files.parentId, parentId));

  return db
    .select()
    .from(files)
    .where(and(...conditions));
}

export async function renameFile(
  userId: string,
  fileId: string,
  fileName: string,
) {
  return await db
    .update(files)
    .set({ name: fileName })
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
}

export async function moveFileToFolder(
  userId: string,
  fileId: string,
  newParentId: string,
) {
  return await db
    .update(files)
    .set({ parentId: newParentId })
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
}

export async function softDeleteFile(userId: string, fileId: string) {
  return await db
    .update(files)
    .set({ isDeleted: true })
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
}
