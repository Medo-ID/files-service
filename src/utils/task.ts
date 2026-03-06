import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { deleteOldItems, getOldDeletedItems } from "../database/queries/files";
import { s3 } from "../config";

export async function autoPurge() {
  const items = await getOldDeletedItems();
  const keys = items
    .filter((i) => i.type === "file")
    .map((i) => ({ Key: i.storageKey as string }));

  if (keys.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: process.env.AWS_BUCKET!,
        Delete: { Objects: keys },
      }),
    );
  }
  await deleteOldItems();
}
