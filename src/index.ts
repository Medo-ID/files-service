import { serve } from "bun";
import { errorHandlingMiddleware } from "./middlewares/error";
import { healthCheck, root } from "./routes/health";
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
import { privatePipe, publicPipe } from "./middlewares/compose";

const server = serve({
  port: 3001,
  routes: {
    // Service-Health
    "/health": { GET: publicPipe(healthCheck) },
    "/": { GET: publicPipe(root) },
    // Files Metadata, Navigation & Download
    "/files/:folder": { GET: privatePipe(listFiles) },
    "/files/:id": {
      GET: privatePipe(getFile),
      DELETE: privatePipe(deleteFileOrFolder),
    },
    "/files/:id/rename": { PATCH: privatePipe(renameFile) },
    "/files/:id/move": { PATCH: privatePipe(moveFile) },
    "/files/:id/download": { GET: privatePipe(download) },
    // Uploads
    "/uploads/initiate": { POST: privatePipe(initiateUpload) },
    "/uploads/:id/complete": { POST: privatePipe(completeUpload) },
    "/uploads/:id/abort": { POST: privatePipe(abortUpload) },
    "/uploads/:id/status": { GET: privatePipe(status) },
  },
  error(err) {
    return errorHandlingMiddleware(err);
  },
});

console.log(`Listening on ${server.url}`);
