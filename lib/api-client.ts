async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  const json = await res.json().catch(() => null);
  const err = json?.error;
  let message: string;
  if (typeof err === "string") message = err;
  else if (err && typeof err === "object") message = JSON.stringify(err);
  else message = res.statusText || `Request failed (${res.status})`;
  throw new Error(message);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfError(res);
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  await throwIfError(res);
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfError(res);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE" });
  await throwIfError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}
