import { verifyToken } from "../utils/jwt";
import { UserNotAuthenticatedError } from "../utils/error";
import type { AuthRequest, RouteHandler } from "./types";

export function isAuth(handler: RouteHandler): RouteHandler {
  return async (req) => {
    const authHeader = req.headers.get("authorization");
    const access = authHeader && authHeader.split(" ")[1];
    if (!access) {
      throw new UserNotAuthenticatedError("You are not authenticated");
    }

    const payload = await verifyToken(access, "files-service");
    if (!payload) {
      throw new UserNotAuthenticatedError("Invalid access token");
    }

    (req as AuthRequest).session = payload;
    return handler(req);
  };
}
