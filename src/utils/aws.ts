import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config";
export const CHUNK_SIZE = 8 * 1024 * 1024;

export async function generatePresignedURLs(
  fileKey: string,
  uploadId: string,
  size: number,
) {
  // split file into ~5mb chunks (I think its the min required by AWS).
  // TO_TAKE_IN_CONSIDERATIONS!!!:
  // If File is huge (10GB) -> Large JSON payload => for that I will use 10mb
  // -> 1000 parts better then 2000 XD
  const numberOfParts = Math.ceil(size / CHUNK_SIZE);
  const promises: Promise<{ PartNumber: number; url: string }>[] = [];

  for (let i = 0; i < numberOfParts; i++) {
    const cmd = new UploadPartCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: fileKey,
      UploadId: uploadId,
      PartNumber: i + 1,
    });
    const PartNumber = i + 1;
    promises.push(
      getSignedUrl(s3, cmd, { expiresIn: 3600 }).then((url) => ({
        PartNumber,
        url,
      })),
    );
  }

  return await Promise.all(promises);
}
