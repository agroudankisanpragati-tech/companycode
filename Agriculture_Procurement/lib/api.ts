const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfToken: string | null = null;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/csrf/`, { credentials: "include" });
  } catch {
    throw new ApiError("Cannot reach the DAPP API. Start the Django backend and try again.", 0);
  }

  const payload = await parseResponse(response);
  if (!response.ok || !payload || typeof payload !== "object" || !("csrf_token" in payload)) {
    throw new ApiError("Could not establish a secure request session.", response.status, payload);
  }

  const token = (payload as { csrf_token: unknown }).csrf_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new ApiError("Could not establish a secure request session.", response.status, payload);
  }
  csrfToken = token;
  return token;
}

function firstValidationMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;

  for (const value of Object.values(record)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

async function execute<T>(path: string, init: RequestInit): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const requestCsrfToken = SAFE_METHODS.has(method) ? null : await getCsrfToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(requestCsrfToken ? { "X-CSRFToken": requestCsrfToken } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the DAPP API. Start the Django backend and try again.", 0);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const fallback = response.status === 401 ? "Authentication required." : "The request could not be completed.";
    throw new ApiError(firstValidationMessage(payload) ?? fallback, response.status, payload);
  }
  return payload as T;
}

export async function apiRequest<T = unknown>(path: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<T> {
  try {
    return await execute<T>(path, init);
  } catch (caught) {
    if (retryOnUnauthorized && caught instanceof ApiError && caught.status === 401 && path !== "/auth/refresh/") {
      await execute("/auth/refresh/", { method: "POST" });
      return execute<T>(path, init);
    }
    throw caught;
  }
}

async function fetchDownload(path: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ApiError("Cannot reach the DAPP API. Start the Django backend and try again.", 0);
  }
}

export async function downloadApiFile(path: string, filename: string): Promise<void> {
  let response = await fetchDownload(path);
  if (response.status === 401) {
    await execute("/auth/refresh/", { method: "POST" });
    response = await fetchDownload(path);
  }
  if (!response.ok) {
    const payload = await parseResponse(response);
    const fallback = response.status === 401 ? "Authentication required." : "The file could not be downloaded.";
    throw new ApiError(firstValidationMessage(payload) ?? fallback, response.status, payload);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
