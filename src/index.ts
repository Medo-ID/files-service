import { serve, type BunRequest } from "bun";

const server = serve({
  port: 3001,
  fetch(req: BunRequest) {
    return new Response("Hello World!");
  },
});
