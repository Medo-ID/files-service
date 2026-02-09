import { serve, type BunRequest } from "bun";
import { errorHandlingMiddleware, notImplementedYet } from "./middleware";
import { getFilesFolder } from "./routes/files";

const server = serve({
  port: 3001,
  routes: {
    "/": (req: BunRequest) => {
      console.log(server.requestIP(req)?.address || "Unknown IP Address.");
      return new Response("Files Service is Working...\n");
    },
    // Metadata & Navigation
    "/files": { GET: getFilesFolder },
    "/files/:id": { GET: notImplementedYet, DELETE: notImplementedYet },
    "/files/:id/rename": { PATCH: notImplementedYet },
    "/files/:id/move": { PATCH: notImplementedYet },
    "/folders": { POST: notImplementedYet },
    // Upload
    "/uploads/initiate": { POST: notImplementedYet },
    "/uploads/:id/part": { PUT: notImplementedYet },
    "/uploads/:id/complete": { POST: notImplementedYet },
    "/uploads/:id/abort": { POST: notImplementedYet },
    "/uploads/:id/status": { GET: notImplementedYet },
    // Download
    "/download/files/:id": { GET: notImplementedYet },
  },
  error(err) {
    return errorHandlingMiddleware(err);
  },
});

console.log(`Listening on ${server.url}`);
