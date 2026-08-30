export class ApiRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function isApiRequestStatus(error: unknown, status: number) {
  return error instanceof ApiRequestError && error.status === status;
}

export function isApiRequestCode(error: unknown, code: string) {
  return error instanceof ApiRequestError && error.code === code;
}
