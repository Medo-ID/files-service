import type { BunRequest } from "bun";
import {
  BadRequestError,
  NotFoundError,
  UserForbiddenError,
  UserNotAuthenticatedError,
} from "./utils/error";
import { respondWithJSON } from "./utils/json";
import { verifyToken, type JWTPayload } from "./utils/jwt";

export type RouteHandler = (req: BunRequest) => Promise<Response> | Response;
export type AuthRequest = BunRequest & { session: JWTPayload };
export type RouteHandlerWithAuth = (
  req: AuthRequest,
) => Promise<Response> | Response;

export function isAuth(handler: RouteHandler): RouteHandler {
  return async (req) => {
    const authHeader = req.headers.get("authorization");
    const access = authHeader && authHeader.split(" ")[1];
    if (!access) {
      throw new UserNotAuthenticatedError("You are not authenticated!");
    }

    const payload = await verifyToken(access, "files-service");
    if (!payload) {
      throw new UserNotAuthenticatedError("Invalid access token!");
    }

    (req as AuthRequest).session = payload;
    return handler(req);
  };
}

export function errorHandlingMiddleware(err: unknown): Response {
  let statusCode = 500;
  let message = "Something went wrong on our end";

  if (err instanceof BadRequestError) {
    statusCode = 400;
    message = err.message;
  } else if (err instanceof UserNotAuthenticatedError) {
    statusCode = 401;
    message = err.message;
  } else if (err instanceof UserForbiddenError) {
    statusCode = 403;
    message = err.message;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    message = err.message;
  }

  if (statusCode >= 500) {
    const errStr = errStringFromError(err);
    if (process.env.ENV === "dev") {
      message = errStr;
    }
    console.log(errStr);
  }

  return respondWithJSON(statusCode, { error: message });
}

export async function notImplementedYet() {
  return Response.json(
    {
      error: "NOT_IMPLEMENTED",
      message: "Upload initiation not implemented yet",
    },
    { status: 501 },
  );
}

function errStringFromError(err: unknown) {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return "An unknown error occurred";
}
