import type { BunRequest } from "bun";
import type { AuthRequest } from "../middleware";

// If type === folder => Zip it then start download. Right?
// Esle start normal downlaod

export async function downloadFile(req: BunRequest) {
  const { session } = req as AuthRequest;
  const fileId = req.params.id;
  return new Response(`${session}\n${fileId}`);
}
