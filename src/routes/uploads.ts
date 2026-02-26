import type { BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/types";
import { insertFileMetadata } from "../database/queries/files";
import { BadRequestError, NotFoundError } from "../utils/error";
import { s3 } from "../config";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getUploadWithFile,
  insertToUploads,
  markFileAsCompleted,
  markUploadAsAborted,
  markUploadAsCompleted,
  updateUploads,
} from "../database/queries/uploads";
import { CHUNK_SIZE, generatePresignedURLs } from "../utils/aws";
import { respondWithJSON } from "../utils/json";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type FileMetadata = {
  name: string;
  size: number;
  type: "file" | "folder";
  mimeType?: string;
  parentId?: string | null;
};

// Max file size: 100MB (safe for S3 free tier and $0 cost operation)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB in bytes

export async function initiateUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const { name, size, type, mimeType, parentId } =
    (await req.json()) as FileMetadata;
  console.log(name, size, type, mimeType, parentId);
  if (!name || !size || !type || !mimeType) {
    throw new BadRequestError("Invalid File Metadata");
  }

  if (size > MAX_FILE_SIZE) {
    throw new BadRequestError(
      `File size exceeds limit. Maximum allowed: 100MB, Your file: ${(size / 1024 / 1024).toFixed(2)}MB`,
    );
  }

  const fileId = crypto.randomUUID();

  if (type === "folder") {
    await insertFileMetadata({
      id: fileId,
      name,
      ownerId: session.sub,
      size: 0,
      type: "folder",
      mimeType: "",
      parentId,
      storageKey: null,
    });

    return respondWithJSON(201, { fileId });
  }

  const s3Key = `${session.sub}/${fileId}`;
  // ** Create Record in File Table **
  const fileRecord = await insertFileMetadata({
    id: fileId,
    name,
    ownerId: session.sub,
    size,
    type,
    mimeType,
    storageKey: s3Key,
  });

  if (!fileRecord) throw new Error("Can't insert file");

  // ** Small file: single presigned url **
  if (size <= MULTIPART_THRESHOLD) {
    console.log("Single");
    const cmd = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET!,
      Key: s3Key,
      ContentType: mimeType,
    });
    const presignedURL = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

    return respondWithJSON(201, { fileId, uploadType: "single", presignedURL });
  }

  // ** Initiate Multipart Upload - Large file **
  const cmd = new CreateMultipartUploadCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: s3Key,
    ContentType: mimeType,
  });

  const { UploadId } = await s3.send(cmd);
  if (!UploadId)
    throw new Error("AWS command: failed to create multipart upload");

  // ** Insert Upload Record in Uploads Table **
  const upload = await insertToUploads({
    fileId: fileId,
    ownerId: session.sub,
    totalSize: size,
    multipartUploadId: UploadId,
  });

  if (!upload) {
    throw new Error("Error initiating upload");
  }

  // ** Generate Presigned URLs URL/Chunk **
  const presignedURLs = await generatePresignedURLs(s3Key, UploadId, size);

  // When using these URLs we need to capture the ETag header from each response
  // -> then send id with it's PartNumber to the completeUpload endpoint.

  return respondWithJSON(201, {
    fileId,
    uploadType: "multipart",
    dbUploadId: upload.id,
    s3UploadId: UploadId,
    presignedURLs,
    chunkSize: CHUNK_SIZE,
  });
}

// This used to complete single file uploading
export async function completeSingleUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const { fileId } = (await req.json()) as { fileId: string };

  console.log(fileId);

  if (!fileId) throw new BadRequestError("fileId is required");

  const updated = await markFileAsCompleted(session.sub, fileId);
  if (!updated) throw new NotFoundError("File not found");

  return respondWithJSON(200, { message: "File marked as completed" });
}

// This is used to complete file uploading for multipart upload
export async function completeUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const dbUploadId = req.params.id;
  if (!dbUploadId) {
    throw new BadRequestError("Upload ID is missing");
  }
  // Get all Parts number with their ETags
  const parts = (await req.json()) as {
    PartNumber: number;
    ETag: string;
  }[];

  if (!parts || parts.length < 1) {
    throw new BadRequestError("Missing Parts/Etags");
  }

  const uploadRecord = await getUploadWithFile(session.sub, dbUploadId);
  if (!uploadRecord) throw new NotFoundError("Upload session not found");

  const sanitizedParts = parts
    .map((p) => ({
      PartNumber: Number(p.PartNumber), // Ensure it's a number
      ETag: p.ETag,
    }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  const s3Key = uploadRecord.files && uploadRecord.files.storageKey;
  if (!s3Key) throw new NotFoundError("File not found");

  const cmd = new CompleteMultipartUploadCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: s3Key,
    UploadId: uploadRecord.uploads.multipartUploadId,
    MultipartUpload: { Parts: sanitizedParts },
  });

  await s3.send(cmd);
  await markUploadAsCompleted(dbUploadId, uploadRecord.uploads.fileId);

  return respondWithJSON(200, {
    message: "Upload has been completed successfully",
  });
}

export async function abortUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  const dbUploadId = req.params.id;
  if (!dbUploadId) {
    throw new BadRequestError("Upload ID is missing");
  }

  const uploadRecord = await getUploadWithFile(session.sub, dbUploadId);
  if (!uploadRecord) throw new Error("Upload session not found");

  const s3Key = uploadRecord.files && uploadRecord.files.storageKey;
  if (!s3Key) throw new NotFoundError("File not found");

  const cmd = new AbortMultipartUploadCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: s3Key,
    UploadId: uploadRecord.uploads.multipartUploadId,
  });

  await s3.send(cmd);
  await markUploadAsAborted(dbUploadId, uploadRecord.uploads.fileId);

  return respondWithJSON(200, { message: "Upload has been aborted" });
}

// This is used to inform client of current status of upload
export async function status(req: BunRequest) {
  const { session } = req as AuthRequest;
  const dbUploadId = req.params.id;
  if (!dbUploadId) {
    throw new BadRequestError("Upload ID is missing");
  }

  const uploadRecord = await getUploadWithFile(session.sub, dbUploadId);
  if (!uploadRecord) throw new NotFoundError("Upload not found");
  if (uploadRecord.uploads.status === "completed") {
    return respondWithJSON(200, {
      status: "completed",
      uploadedSize: uploadRecord.uploads.totalSize,
    });
  }

  const s3Key = uploadRecord.files && uploadRecord.files.storageKey;
  if (!s3Key) throw new NotFoundError("File not found");
  const cmd = new ListPartsCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: s3Key,
    UploadId: uploadRecord.uploads.multipartUploadId,
  });

  const { Parts } = await s3.send(cmd);
  const uploadedSize =
    Parts?.reduce((acc, curr) => acc + (curr.Size || 0), 0) || 0;

  if (uploadedSize > 0 && uploadedSize !== uploadRecord.uploads.uploadedSize) {
    // Fire and forget (don't await it, let it run in background)
    updateUploads(
      session.sub,
      uploadRecord.uploads.multipartUploadId,
      uploadedSize,
      "uploading",
    ).catch((err) => {
      console.error("Failed to update upload progress:", err);
    });
  }

  return respondWithJSON(200, {
    status: uploadRecord.uploads.status,
    uploadedSize,
    uploadedParts:
      Parts?.map((p) => ({ PartNumber: p.PartNumber, etag: p.ETag })) || [],
  });
}

export async function regeneratePresignedUrls(req: BunRequest) {
  const { session } = req as AuthRequest;
  const dbUploadId = req.params.id;
  if (!dbUploadId) {
    throw new BadRequestError("Upload ID is missing");
  }

  const uploadRecord = await getUploadWithFile(session.sub, dbUploadId);
  if (!uploadRecord) throw new NotFoundError("Upload not found");

  const s3Key = uploadRecord.files?.storageKey;
  if (!s3Key) throw new NotFoundError("File not found");

  const uploadId = uploadRecord.uploads.multipartUploadId;
  const totalSize = uploadRecord.uploads.totalSize;

  const presignedURLs = await generatePresignedURLs(s3Key, uploadId, totalSize);

  return respondWithJSON(200, {
    presignedURLs,
    chunkSize: CHUNK_SIZE,
  });
}
