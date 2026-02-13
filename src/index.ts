import { serve, type BunRequest } from "bun";
import { errorHandlingMiddleware } from "./middlewares/error";
import { isAuth } from "./middlewares/auth";
import {
  deleteFileOrFolder,
  download,
  getFile,
  listFiles,
  moveFile,
  renameFile,
} from "./routes/files";
import {
  abortUpload,
  completeUpload,
  initiateUpload,
  status,
} from "./routes/uploads";

const server = serve({
  port: 3001,
  routes: {
    "/": (req: BunRequest) => {
      console.log(server.requestIP(req)?.address || "Unknown IP Address.");
      return new Response("Files Service is Working...\n");
    },
    // Files Metadata, Navigation & Download
    "/files/:folder": { GET: isAuth(listFiles) },
    "/files/:id": { GET: isAuth(getFile), DELETE: isAuth(deleteFileOrFolder) },
    "/files/:id/rename": { PATCH: isAuth(renameFile) },
    "/files/:id/move": { PATCH: isAuth(moveFile) },
    "/files/:id/download": { GET: isAuth(download) },
    // Uploads
    "/uploads/initiate": { POST: isAuth(initiateUpload) },
    "/uploads/:id/complete": { POST: isAuth(completeUpload) },
    "/uploads/:id/abort": { POST: isAuth(abortUpload) },
    "/uploads/:id/status": { GET: isAuth(status) },
  },
  error(err) {
    return errorHandlingMiddleware(err);
  },
});

console.log(`Listening on ${server.url}`);
