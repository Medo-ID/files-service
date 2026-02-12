import { type BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/auth";
import {
  getFileById,
  moveFileToFolder,
  renameFileOrFolder,
  softDeleteRecursive,
  userFiles,
} from "../database/queries/files";
import { respondWithJSON } from "../utils/json";
import { BadRequestError, NotFoundError } from "../utils/error";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config";

export async function listFiles(req: BunRequest) {
  const { session } = req as AuthRequest;
  const parentId = req.params.folder || null;
  const files = await userFiles(session.sub, parentId);

  return respondWithJSON(200, { files });
}

export async function getFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID!");

  const file = await getFileById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found!");

  // TODO: Not implemented yet!!
  if (file.type === "folder") {
    throw new BadRequestError("Cannot download a folder directely");
  }

  const cmd = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: file.storageKey!,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });

  return respondWithJSON(200, {
    url,
    name: file.name,
    mimeType: file.mimeType,
    fileSize: file.size,
  });
}

export async function deleteFileOrFolder(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID!");

  await softDeleteRecursive(session.sub, fileId);
  return respondWithJSON(204, "Item deleted");
}

export async function renameFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID!");

  const { newName } = (await req.json()) as { newName: string };
  await renameFileOrFolder(session.sub, fileId, newName);

  return respondWithJSON(204, "Name has been updated!");
}

export async function moveFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID!");

  const { newParentId } = (await req.json()) as { newParentId: string | null };

  if (newParentId) {
    const parentFolder = await getFileById(session.sub, newParentId);
    if (!parentFolder || parentFolder.type !== "folder") {
      throw new BadRequestError("Invalid destination folder");
    }
    if (newParentId === fileId) {
      throw new BadRequestError("Cannot move folder into itself");
    }
  }

  await moveFileToFolder(session.sub, fileId, newParentId);

  return respondWithJSON(204, "Item has been moved!");
}
