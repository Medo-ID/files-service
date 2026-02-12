import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { files, uploads, type NewUpload } from "../schema";

export async function insertToUploads(upload: NewUpload) {
  const [result] = await db.insert(uploads).values(upload).returning();
  return result;
}
// Am I HANDLING THE JOIN CORRECTLLY?
export async function getUploadWithFile(userId: string, uploadId: string) {
  const [result] = await db
    .select()
    .from(uploads)
    .leftJoin(files, eq(uploads.fileId, files.id))
    .where(and(eq(uploads.ownerId, userId), eq(uploads.id, uploadId)));

  return result;
}

export async function updateUploads(
  userId: string,
  uploadId: string,
  uploadedSize: number,
  status?: "uploading" | "completed" | "aborted",
) {
  await db
    .update(uploads)
    .set({ status, uploadedSize })
    .where(
      and(eq(uploads.ownerId, userId), eq(uploads.multipartUploadId, uploadId)),
    );
}

export async function markUploadAsCompleted(uploadId: string, fileId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(uploads)
      .set({ status: "completed" })
      .where(eq(uploads.id, uploadId));

    await tx
      .update(files)
      .set({ status: "completed" })
      .where(eq(files.id, fileId));
  });
}

export async function markUploadAsAborted(uploadId: string, fileId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(uploads)
      .set({ status: "aborted" })
      .where(eq(uploads.id, uploadId));

    await tx.update(files).set({ isDeleted: true }).where(eq(files.id, fileId));
  });
}
