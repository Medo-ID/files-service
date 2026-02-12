import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { files, type NewFile } from "../schema";

export async function insertFileMatadata(file: NewFile) {
  const [result] = await db.insert(files).values(file).returning();
  return result;
}

export async function getFileById(userId: string, fileId: string) {
  const [result] = await db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
  return result;
}

export async function userFiles(userId: string, parentId: string | null) {
  const conditions = [
    eq(files.ownerId, userId),
    eq(files.isDeleted, false),
    eq(files.status, "completed"),
  ];

  if (parentId) {
    conditions.push(eq(files.parentId, parentId));
  } else {
    conditions.push(isNull(files.parentId));
  }

  return db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt));
}

export async function renameFileOrFolder(
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
  newParentId: string | null,
) {
  return await db
    .update(files)
    .set({ parentId: newParentId })
    .where(and(eq(files.ownerId, userId), eq(files.id, fileId)));
}

// ** RECURSIVE DELETE **
export async function softDeleteRecursive(userId: string, fileId: string) {
  await db.execute(sql`
    WITH RECURSIVE folder_tree AS (
      SELECT id FROM ${files} 
      WHERE id = ${fileId} AND owner_id = ${userId}
        
      UNION ALL
        
      SELECT f.id FROM ${files} f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
    )
    UPDATE ${files}
    SET is_deleted = true
    WHERE id IN (SELECT id FROM folder_tree)
    AND owner_id = ${userId};
  `);
}
