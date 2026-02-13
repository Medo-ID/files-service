import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { files, type File, type NewFile } from "../schema";

export async function insertFileMetadata(file: NewFile) {
  const [result] = await db.insert(files).values(file).returning();
  return result;
}

export async function getFileById(userId: string, fileId: string) {
  const [result] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.ownerId, userId),
        eq(files.id, fileId),
        eq(files.isDeleted, false),
      ),
    );
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

export async function getAllDescendantFiles(userId: string, targetId: string) {
  const { rows } = await db.execute(sql`
    WITH RECURSIVE files_tree AS (
      SELECT 
        id, 
        type, 
        storage_key,
        parent_id,
        name::text AS relative_path 
      FROM ${files}
      WHERE id = ${targetId} 
        AND owner_id = ${userId}
        AND is_deleted = false

      UNION ALL

      SELECT
        f.id,
        f.type,
        f.storage_key,
        f.parent_id,
        (ft.relative_path || '/' || f.name)::text AS relative_path -- Append child name to parent path
      FROM ${files} f
      INNER JOIN files_tree ft ON f.parent_id = ft.id
      WHERE f.owner_id = ${userId} 
        AND f.is_deleted = false
    )
    SELECT 
      id, 
      type,
      storage_key AS "storageKey",
      relative_path AS "relativePath" 
    FROM files_tree
    WHERE type = 'file';
  `);

  return rows as {
    id: string;
    storageKey: string;
    relativePath: string;
  }[];
}

export async function checkNameCollision(
  userId: string,
  parentId: string | null,
  name: string,
) {
  const conditions = [
    eq(files.ownerId, userId),
    eq(files.name, name),
    eq(files.isDeleted, false),
  ];

  conditions.push(
    parentId ? eq(files.parentId, parentId) : isNull(files.parentId),
  );

  const [existing] = await db
    .select()
    .from(files)
    .where(and(...conditions));
  return !!existing;
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

export async function isDescendant(
  userId: string,
  targetFileId: string,
  newParentId: string,
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    WITH RECURSIVE path_up AS (
      -- Start at the destination folder
      SELECT id, parent_id FROM ${files}
      WHERE id = ${newParentId} AND owner_id = ${userId}
      
      UNION ALL
      
      -- Walk up the tree to the root
      SELECT f.id, f.parent_id FROM ${files} f
      INNER JOIN path_up p ON f.id = p.parent_id
    )
    -- If the targetFileId is found anywhere in this path, it's a cycle!
    SELECT 1 FROM path_up WHERE id = ${targetFileId};
  `);

  return rows.length > 0;
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
      WHERE id = ${fileId} 
        AND owner_id = ${userId}
        AND is_deleted = false
        
      UNION ALL
        
      SELECT f.id FROM ${files} f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
      WHERE f.is_deleted = false
    )
    UPDATE ${files}
    SET is_deleted = true
    WHERE id IN (SELECT id FROM folder_tree)
      AND owner_id = ${userId};
  `);
}
