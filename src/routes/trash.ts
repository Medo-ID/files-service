import { type BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/types";
import {
  emptyTrash,
  getFileById,
  getDeletedItems,
  permanentlyDeleteTree,
  restoreFile,
  restoreFolderTree,
  getAllDescendantFiles,
  getDeletedItemById,
} from "../database/queries/files";
import { respondWithJSON } from "../utils/json";
import { BadRequestError, NotFoundError } from "../utils/error";
import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config";

export async function listDeletedFiles(req: BunRequest) {
  const { session } = req as AuthRequest;
  const deletedFiles = await getDeletedItems(session.sub);

  return respondWithJSON(200, deletedFiles);
}

export async function restore(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const file = await getDeletedItemById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found");

  await assertParentIsRestored(session.sub, file.parentId);

  if (file.type === "file") {
    await restoreFile(session.sub, file.id);
  } else {
    await restoreFolderTree(session.sub, file.id);
  }

  return respondWithJSON(200, { message: "Item restored" });
}

export async function permanent(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const file = await getDeletedItemById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found");

  if (file.type === "file") {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET!,
        Key: file.storageKey!,
      }),
    );
  } else {
    const files = await getAllDescendantFiles(session.sub, file.id);
    const keys = files
      .filter((i) => i.type === "file")
      .map((i) => ({ Key: i.storageKey! }));

    if (keys.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: process.env.AWS_BUCKET!,
          Delete: { Objects: keys },
        }),
      );
    }
  }

  await permanentlyDeleteTree(session.sub, file.id);
  return respondWithJSON(200, { message: "item deleted permanently" });
}

export async function empty(req: BunRequest) {
  const { session } = req as AuthRequest;
  const items = await getDeletedItems(session.sub);
  const keys = items
    .filter((i) => i.type === "file")
    .map((i) => ({ Key: i.storageKey! }));

  if (keys.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: process.env.AWS_BUCKET!,
        Delete: { Objects: keys },
      }),
    );
  }
  await emptyTrash(session.sub);
  return respondWithJSON(200, { message: "trash has been emptied" });
}

// Helpers:
async function assertParentIsRestored(userId: string, parentId: string | null) {
  if (!parentId) return;

  const parent = await getFileById(userId, parentId);
  if (!parent) throw new NotFoundError("Parent not found");

  if (parent.isDeleted) {
    throw new BadRequestError(
      "Parent folder is still deleted. Restore it first.",
    );
  }
}
