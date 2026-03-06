import { serve } from "bun";
import { errorHandlingMiddleware } from "./middlewares/error";
import { healthCheck, root } from "./routes/health";
import {
  softDeleteOne,
  download,
  getBreadcrumb,
  getFile,
  listFiles,
  moveFile,
  renameFile,
  softDeleteMany,
} from "./routes/files";
import {
  abortUpload,
  completeSingleUpload,
  completeUpload,
  initiateUpload,
  regeneratePresignedUrls,
  status,
} from "./routes/uploads";
import { empty, listDeletedFiles, permanent, restore } from "./routes/trash";
import { privatePipe, publicPipe } from "./middlewares/compose";
import nodeCron from "node-cron";
import { autoPurge } from "./utils/task";

const server = serve({
  port: 3001,
  routes: {
    // Service-Health
    "/health": { GET: privatePipe(healthCheck) },
    "/": { GET: publicPipe(root) },
    // Files Metadata, Navigation, Download
    "/files": {
      GET: privatePipe(listFiles),
      DELETE: privatePipe(softDeleteMany),
    },
    "/files/:id": {
      GET: privatePipe(getFile),
      DELETE: privatePipe(softDeleteOne),
    },
    "/files/:id/breadcrumb": { GET: privatePipe(getBreadcrumb) },
    "/files/:id/rename": { PATCH: privatePipe(renameFile) },
    "/files/:id/move": { PATCH: privatePipe(moveFile) },
    "/files/:id/download": { GET: privatePipe(download) },
    // Uploads
    "/uploads/initiate": { POST: privatePipe(initiateUpload) },
    "/uploads/complete-single": { POST: privatePipe(completeSingleUpload) },
    "/uploads/:id/complete": { POST: privatePipe(completeUpload) },
    "/uploads/:id/abort": { POST: privatePipe(abortUpload) },
    "/uploads/:id/status": { GET: privatePipe(status) },
    "/uploads/:id/regenerate": { GET: privatePipe(regeneratePresignedUrls) },
    // Trash
    "/trash": { GET: privatePipe(listDeletedFiles) },
    "/trash/:id/restore": { POST: privatePipe(restore) },
    "/trash/:id/permanent": { DELETE: privatePipe(permanent) },
    "/trash/empty": { DELETE: privatePipe(empty) },
  },
  error(err) {
    return errorHandlingMiddleware(err);
  },
});

console.log(`Listening on ${server.url}`);

nodeCron.schedule("0 3 * * *", async () => {
  await autoPurge();
});
