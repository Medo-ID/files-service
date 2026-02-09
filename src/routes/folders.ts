import type { BunRequest } from "bun";
import type { AuthRequest } from "../middleware";

export async function getFolders(req: BunRequest) {
  const { session } = req as AuthRequest;
  return new Response(`${session}`);
}
