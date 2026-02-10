import type { BunRequest } from "bun";
import type { AuthRequest } from "../middlewares/auth";

// Improve naming, add more routes if needed
// Don't do any implementations, add just suggestions

export async function listFiles(req: BunRequest) {
  const { session } = req as AuthRequest;
  const params = new URL(req.url).searchParams;
  const parentId = params.get("parent_id");
  return new Response(`${session}\n${parentId}`);
}

export async function getFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  return new Response(`${session}\n${fileId}`);
}

export async function deleteFileOrFolder(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  return new Response(`${session}\n${fileId}`);
}

export async function renameFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  return new Response(`${session}\n${fileId}`);
}

export async function moveFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  return new Response(`${session}\n${fileId}`);
}
