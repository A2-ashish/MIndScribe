export class HttpError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition: any, status: number, message: string, code?: string) {
  if (!condition) throw new HttpError(status, message, code);
}

export function errorResponse(err: any) {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: err.message, code: err.code, details: err.details } };
  }
  return { status: 500, body: { error: 'Internal Server Error' } };
}
