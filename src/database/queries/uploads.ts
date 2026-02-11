import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { uploads, type NewUpload } from "../schema";

export async function insertToUploads(upload: NewUpload) {
  await db.insert(uploads).values(upload);
}

export async function updateUploadStatus(
  userId: string,
  uploadId: string,
  status: "uploading" | "completed" | "aborted",
) {
  await db
    .update(uploads)
    .set({ status })
    .where(
      and(eq(uploads.ownerId, userId), eq(uploads.multipartUploadId, uploadId)),
    );
}
