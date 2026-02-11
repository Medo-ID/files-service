import type { BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/auth";
import { insertFileMatadata } from "../database/queries/files";
import { BadRequestError } from "../utils/error";
import { s3 } from "../config";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { insertToUploads } from "../database/queries/uploads";
import { generatePresinedURLs } from "../utils/aws";
import { respondWithJSON } from "../utils/json";

export type FileMetadata = {
  name: string;
  size: number;
  type: "file" | "folder";
  mimeType: string;
};

export async function initiateUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const { name, size, type, mimeType } = (await req.json()) as FileMetadata;
  if (!name || !size || !type || !mimeType) {
    throw new BadRequestError("Invalid File Metadata!");
  }

  // ** Create Record in File Table **
  const fileRecord = await insertFileMatadata({
    name,
    ownerId: session.sub,
    size,
    type,
    mimeType,
  });

  if (!fileRecord) throw new Error("Can't insert file!");
  const fileId = fileRecord.id;

  // ** Initiate Multipart Upload **
  const cmd = new CreateMultipartUploadCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: fileId,
    ContentType: mimeType,
  });
  const { UploadId, ChecksumType } = await s3.send(cmd);
  if (!UploadId)
    throw new Error("AWS command: failed to create multipart upload!");

  // ** Insert Upload Record in Uploads Table **
  await insertToUploads({
    fileId: fileId,
    ownerId: session.sub,
    totalSize: size,
    multipartUploadId: UploadId,
  });

  // ** Generate Presigned URLs URL/Chunk **
  const presignedURLs = await generatePresinedURLs(fileId, UploadId, size);

  // When using these URLs we need to capture the ETag header from each response
  // -> then send id with it's PartNumber to the completeUpload endpoint.

  return respondWithJSON(201, { uploadId: UploadId, presignedURLs });
}

export async function partUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const uploadId = req.params.id;
  return new Response(`${session}\n${uploadId}`);
}

export async function completeUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const uploadId = req.params.id;
  return new Response(`${session}\n${uploadId}`);
}

export async function abortUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const uploadId = req.params.id;
  return new Response(`${session}\n${uploadId}`);
}

export async function status(req: BunRequest) {
  const { session } = req as AuthRequest;
  const uploadId = req.params.id;
  return new Response(`${session}\n${uploadId}`);
}
