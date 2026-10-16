export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId: string | null,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Floxi-Request": "1",
      ...options.headers,
    },
  });
  const body = await response
    .json()
    .catch(() => ({ message: "Unexpected response. Please try again." }));
  if (!response.ok)
    throw new ApiError(
      response.status,
      Array.isArray(body.message)
        ? body.message.join("; ")
        : (body.message ?? "Request failed."),
      response.headers.get("X-Request-ID"),
    );
  return body;
}
export function post<T>(path: string, body: unknown = {}) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
