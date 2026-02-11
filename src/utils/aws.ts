import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config";

export async function generatePresinedURLs(
  fileKey: string,
  uploadId: string,
  size: number,
) {
  // split file into ~5mb chunks (I think its the min required by AWS).
  // TO_TAKE_IN_CONSIDERATIONS!!!:
  // If File is huge (10GB) -> Large JSON
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const numberOfParts = Math.ceil(size / CHUNK_SIZE);

  const promises: Promise<string>[] = [];

  for (let i = 0; i < numberOfParts; i++) {
    const cmd = new UploadPartCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: fileKey,
      UploadId: uploadId,
      PartNumber: i + 1,
    });

    promises.push(getSignedUrl(s3, cmd, { expiresIn: 3600 }));
  }

  return await Promise.all(promises);
}
