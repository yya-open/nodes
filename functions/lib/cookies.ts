export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
    maxAge?: number;
  } = {}
) {
  const segs = [`${name}=${encodeURIComponent(value)}`];
  segs.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== undefined) segs.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) segs.push("HttpOnly");
  if (opts.secure) segs.push("Secure");
  segs.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return segs.join("; ");
}
