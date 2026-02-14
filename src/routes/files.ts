import { type BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/types";
import {
  checkNameCollision,
  getAllDescendantFiles,
  getFileById,
  isDescendant,
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
import archiver from "archiver";
import { PassThrough } from "node:stream";

// Max file size: 100MB (safe for S3 free tier and $0 cost operation)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

export async function listFiles(req: BunRequest) {
  const { session } = req as AuthRequest;
  const parentId = req.params.folder || null;
  console.log(parentId, session.sub);
  const files = await userFiles(session.sub, parentId);

  return respondWithJSON(200, { files });
}

// This get file is not for downloading purpose
// It's just for getting one item and display it to the user in the browser
export async function getFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const file = await getFileById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found");

  const cmd = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: file.storageKey!,
    // Force the browser to view it inline rather than download
    ResponseContentDisposition: `inline; filename="${file.name}"`,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });

  return respondWithJSON(200, {
    url,
    name: file.name,
    mimeType: file.mimeType,
    fileSize: file.size,
  });
}

export async function renameFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const { newName } = (await req.json()) as { newName: string };
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const file = await getFileById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found");

  const hasCollision = await checkNameCollision(
    session.sub,
    file.parentId,
    newName,
  );
  if (hasCollision)
    throw new BadRequestError("A file with this name already exists here");

  await renameFileOrFolder(session.sub, fileId, newName);
  return respondWithJSON(200, { message: "Name updated" });
}

export async function moveFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const { newParentId } = (await req.json()) as { newParentId: string | null };
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const file = await getFileById(session.sub, fileId);
  if (!file) throw new NotFoundError("File not found");

  if (newParentId) {
    const parentFolder = await getFileById(session.sub, newParentId);
    if (!parentFolder || parentFolder.type !== "folder") {
      throw new BadRequestError("Invalid destination folder");
    }
    if (newParentId === fileId) {
      throw new BadRequestError("Cannot move folder into itself");
    }
    if (file.type === "folder") {
      const isCycle = await isDescendant(session.sub, fileId, newParentId);
      if (isCycle)
        throw new BadRequestError(
          "Cannot move a folder into its own subfolder",
        );
    }
  }

  const hasCollision = await checkNameCollision(
    session.sub,
    newParentId,
    file.name,
  );
  if (hasCollision)
    throw new BadRequestError("Destination already has a file with this name");

  await moveFileToFolder(session.sub, fileId, newParentId);
  return respondWithJSON(200, { message: "Item moved" });
}

export async function deleteFileOrFolder(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  await softDeleteRecursive(session.sub, fileId);
  return respondWithJSON(200, { message: "Item deleted" });
}

export async function download(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  if (!fileId) throw new BadRequestError("Missing file ID");

  const target = await getFileById(session.sub, fileId);
  if (!target) throw new NotFoundError("File not found");

  if (target.size > MAX_FILE_SIZE) {
    throw new BadRequestError(
      `File size exceeds download limit. Maximum allowed: 100MB, File size: ${(target.size / 1024 / 1024).toFixed(2)}MB`,
    );
  }

  // ** File Download **
  if (target.type === "file") {
    const cmd = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET!,
      Key: target.storageKey!,
      // "attachment" tells browser to download it immediately
      ResponseContentDisposition: `attachment; filename="${target.name}"`,
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    return respondWithJSON(200, { type: "file", url });
  }

  // ** Folder Download **
  const allFiles = await getAllDescendantFiles(session.sub, target.id);
  if (!allFiles.length) throw new NotFoundError("Folder is empty or not found");

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passThrough = new PassThrough();

  archive.on("error", (err) => {
    console.error("Archive Error:", err);
    passThrough.destroy(err);
  });
  archive.pipe(passThrough);

  (async () => {
    try {
      for (const file of allFiles) {
        const cmd = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET!,
          Key: file.storageKey,
        });

        const s3Response = await s3.send(cmd);
        if (!s3Response.Body) continue;

        archive.append(s3Response.Body as any, { name: file.relativePath });
      }

      archive.finalize();
    } catch (err) {
      archive.abort();
      passThrough.destroy(err as Error);
    }
  })();

  return new Response(passThrough as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${target.name}.zip"`,
    },
  });
}
