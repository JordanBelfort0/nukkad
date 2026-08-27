import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const message = e.issues
      .map((i) => {
        const field = i.path.join(".");
        return field ? `${field}: ${i.message}` : i.message;
      })
      .join("; ");
    return Response.json({ error: message }, { status: 400 });
  }
  console.error(e);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
