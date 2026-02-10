import type { HeadersInit } from "bun";

export function respondWithJSON<T>(
  status: number,
  payload: T,
  headers: HeadersInit = {},
) {
  const responseHeaders = new Headers({
    "Content-Type": "application/json",
    ...headers,
  });

  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
}
