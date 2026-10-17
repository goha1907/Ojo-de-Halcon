export interface ApiIssue {
  path: Array<string | number>;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly issues: ApiIssue[] = [],
    /** The server warns that one more unconfirmed lookup will block the user. */
    readonly warn = false,
  ) {
    super(code);
  }
}

export async function apiRequest<T>(
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    issues?: ApiIssue[];
    warn?: boolean;
  } & T;
  if (!response.ok) {
    throw new ApiError(response.status, payload.error ?? "UNKNOWN", payload.issues ?? [], payload.warn === true);
  }
  return payload;
}
