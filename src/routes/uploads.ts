import type { BunRequest } from "bun";
import type { AuthRequest } from "../middleware";

// If file is type of folder I need to use a loop to initiat upload?
// How can I handle a large file with a lot of files inside it?

export async function initiateUpload(req: BunRequest) {
  const { session } = req as AuthRequest;
  return new Response(`${session}`);
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
