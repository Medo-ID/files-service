import { verifyToken } from "../utils/jwt";
import { UserNotAuthenticatedError } from "../utils/error";
import type { AuthRequest, RouteHandler } from "./types";

export function isAuth(handler: RouteHandler): RouteHandler {
  return async (req) => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      throw new UserNotAuthenticatedError("Missing or malformed token");
    }

    try {
      const payload = await verifyToken(token, "files-service");
      (req as AuthRequest).session = payload;
      return handler(req);
    } catch (err) {
      console.error("Auth middleware error", err);
      throw new UserNotAuthenticatedError("Invalid or expired token");
    }
  };
}
