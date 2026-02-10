import { serve, type BunRequest } from "bun";
import { errorHandlingMiddleware } from "./middlewares/error";
import { listFiles } from "./routes/files";

// Don't wan to update route handlers until names and routes are confirmed
const server = serve({
  port: 3001,
  routes: {
    "/": (req: BunRequest) => {
      console.log(server.requestIP(req)?.address || "Unknown IP Address.");
      return new Response("Files Service is Working...\n");
    },
    // Files Metadata, Navigation & Download
    "/files": { GET: listFiles },
    "/files/:id": { GET: notImplementedYet, DELETE: notImplementedYet },
    "/files/:id/rename": { PATCH: notImplementedYet },
    "/files/:id/move": { PATCH: notImplementedYet },
    "/files/:id/download": { GET: notImplementedYet },
    // Uploads
    "/uploads/initiate": { POST: notImplementedYet },
    "/uploads/:id/part": { PUT: notImplementedYet },
    "/uploads/:id/complete": { POST: notImplementedYet },
    "/uploads/:id/abort": { POST: notImplementedYet },
    "/uploads/:id/status": { GET: notImplementedYet },
  },
  error(err) {
    return errorHandlingMiddleware(err);
  },
});

async function notImplementedYet() {
  return Response.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "Endpoint not implemented yet",
    },
    { status: 501 },
  );
}

console.log(`Listening on ${server.url}`);
