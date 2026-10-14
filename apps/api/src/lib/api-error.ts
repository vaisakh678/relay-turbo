export type ResponseMeta = Record<string, unknown>;

export class APIError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Optional out-of-band metadata surfaced in the error response's `meta` field. */
    public readonly meta?: ResponseMeta,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export const BadRequest = (message: string, meta?: ResponseMeta) => new APIError(400, message, meta);
export const Unauthorized = (message = "Unauthorized") => new APIError(401, message);
export const Forbidden = (message = "Forbidden") => new APIError(403, message);
export const NotFound = (message: string) => new APIError(404, message);
export const Conflict = (message: string) => new APIError(409, message);
export const TooManyRequests = (message: string, meta?: ResponseMeta) => new APIError(429, message, meta);
export const ServiceUnavailable = (message: string) => new APIError(503, message);
