import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { files, type NewFile } from "../schema";

/*
 * BEST PRACTICE?
 * - Should I use one function that get all types of files, instead of two functions.
 * - Also I am using the userId just when getting and inserting files,
 *  assuming user can only perform actions to visible content. Should I add also the userId constraint
 *  for other actions, to prevent executing outside the app, which is I think impossible when enabling CORS.
 * - Improve naming and queries when possible, plus add more if needed.
 * - Do I need bulkInsert?
 */

export async function insertFileMatadata(file: NewFile) {
  const [result] = await db.insert(files).values(file).returning();
  return result?.id;
}

export async function getFileById(fileId: string) {
  const [result] = await db.select().from(files).where(eq(files.id, fileId));
  return result;
}

export async function getUsersFolders(userId: string) {
  return await db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, userId), eq(files.type, "folder")));
}

export async function getUsersFiles(userId: string) {
  return await db
    .select()
    .from(files)
    .where(and(eq(files.ownerId, userId), eq(files.type, "file")));
}

export async function renameFile(fileId: string, fileName: string) {
  return await db
    .update(files)
    .set({ name: fileName })
    .where(eq(files.id, fileId));
}

export async function moveFile(fileId: string, newParentId: string) {
  return await db
    .update(files)
    .set({ parentId: newParentId })
    .where(eq(files.id, fileId));
}

export async function deleteFileOrFolder(fileId: string) {
  return await db.delete(files).where(eq(files.id, fileId));
}
