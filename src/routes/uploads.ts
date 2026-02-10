import type { BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/auth";

// Is the insert querie will be used here in the upload route: initiateUpload
// If file is type of folder I need to use a loop to initiat upload?
// How can I handle a large file with a lot of files inside it?

export async function initiateUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  return new Response(`${session}`);
  // insert file metadata
  // insert upload record
  // return upload ID
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
