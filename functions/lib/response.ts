export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function err(status: number, message: string) {
  return json({ error: message }, { status });
}

export async function readJson<T = any>(req: Request): Promise<T> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Content-Type 必须为 application/json");
  return (await req.json()) as T;
}
