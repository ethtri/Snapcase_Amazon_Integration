export class SpApiError extends Error {
  status: number;
  responseBody: string;
  requestId?: string;

  constructor(message: string, status: number, responseBody: string, requestId?: string) {
    super(message);
    this.name = "SpApiError";
    this.status = status;
    this.responseBody = responseBody;
    this.requestId = requestId;
  }
}
