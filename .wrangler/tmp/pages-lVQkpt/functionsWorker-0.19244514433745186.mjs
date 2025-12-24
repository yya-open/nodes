var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// lib/db.ts
async function dbOne(db, sql, params = []) {
  const r = await db.prepare(sql).bind(...params).first();
  return r ?? null;
}
__name(dbOne, "dbOne");
async function dbAll(db, sql, params = []) {
  const r = await db.prepare(sql).bind(...params).all();
  return r.results;
}
__name(dbAll, "dbAll");
async function dbRun(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}
__name(dbRun, "dbRun");

// lib/response.ts
function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
__name(json, "json");
function err(status, message) {
  return json({ error: message }, { status });
}
__name(err, "err");
async function readJson(req) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Content-Type \u5FC5\u987B\u4E3A application/json");
  return await req.json();
}
__name(readJson, "readJson");

// lib/cookies.ts
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}
__name(parseCookies, "parseCookies");
function serializeCookie(name, value, opts = {}) {
  const segs = [`${name}=${encodeURIComponent(value)}`];
  segs.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== void 0) segs.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) segs.push("HttpOnly");
  if (opts.secure) segs.push("Secure");
  segs.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return segs.join("; ");
}
__name(serializeCookie, "serializeCookie");

// lib/crypto.ts
function b64urlEncode(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(b64urlEncode, "b64urlEncode");
function b64urlDecodeToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - s.length % 4) : "";
  const bin = atob(s + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
__name(b64urlDecodeToBytes, "b64urlDecodeToBytes");
async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}
__name(hmacSha256, "hmacSha256");
function randomId(bytes = 16) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b64urlEncode(b);
}
__name(randomId, "randomId");
async function pbkdf2Hash(passcode, saltB64url, iterations = 15e4) {
  const salt = b64urlDecodeToBytes(saltB64url);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
  return b64urlEncode(new Uint8Array(bits));
}
__name(pbkdf2Hash, "pbkdf2Hash");
function b64urlEncodeText(s) {
  return b64urlEncode(new TextEncoder().encode(s));
}
__name(b64urlEncodeText, "b64urlEncodeText");
function b64urlDecodeText(s) {
  const bytes = b64urlDecodeToBytes(s);
  return new TextDecoder().decode(bytes);
}
__name(b64urlDecodeText, "b64urlDecodeText");

// lib/auth.ts
var COOKIE_NAME = "memo_token";
function setAuthCookie(token, secure2) {
  return serializeCookie(COOKIE_NAME, token, { httpOnly: true, secure: secure2, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
__name(setAuthCookie, "setAuthCookie");
function clearAuthCookie(secure2) {
  return serializeCookie(COOKIE_NAME, "", { httpOnly: true, secure: secure2, sameSite: "Lax", path: "/", maxAge: 0 });
}
__name(clearAuthCookie, "clearAuthCookie");
async function signToken(env, payload) {
  const body = b64urlEncodeText(JSON.stringify(payload));
  const sig = await hmacSha256(env.TOKEN_SECRET, body);
  return `${body}.${sig}`;
}
__name(signToken, "signToken");
async function verifyToken(env, token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = await hmacSha256(env.TOKEN_SECRET, body);
  if (expect !== sig) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecodeText(body));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}
__name(verifyToken, "verifyToken");
async function getPrincipal(ctx) {
  const cookies = parseCookies(ctx.request.headers.get("cookie"));
  const token = cookies[COOKIE_NAME];
  if (!token) return { authenticated: false, role: "none" };
  const payload = await verifyToken(ctx.env, token);
  if (!payload) return { authenticated: false, role: "none" };
  return {
    authenticated: true,
    id: String(payload.sub),
    role: payload.role,
    username: payload.username ? String(payload.username) : void 0,
    exp: payload.exp
  };
}
__name(getPrincipal, "getPrincipal");
function requireAuth(p) {
  if (!p.authenticated) return err(401, "\u672A\u767B\u5F55");
  return null;
}
__name(requireAuth, "requireAuth");
function requireRole(p, role) {
  if (!p.authenticated) return err(401, "\u672A\u767B\u5F55");
  const rank = { guest: 1, user: 2, admin: 3 };
  if (rank[p.role] < rank[role]) return err(403, "\u6743\u9650\u4E0D\u8DB3");
  return null;
}
__name(requireRole, "requireRole");
function newGuestSubject() {
  return `guest:${randomId(18)}`;
}
__name(newGuestSubject, "newGuestSubject");

// api/admin/users/[id].ts
function sanitizeRole(role) {
  if (!role) return void 0;
  if (role === "admin" || role === "user") return role;
  return null;
}
__name(sanitizeRole, "sanitizeRole");
var onRequestPatch = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;
  const id = ctx.params.id;
  const user = await dbOne(ctx.env.DB, "SELECT id, role FROM users WHERE id = ?", [id]);
  if (!user) return err(404, "\u7528\u6237\u4E0D\u5B58\u5728");
  const body = await readJson(ctx.request);
  const role = sanitizeRole(body.role);
  if (role === null) return err(400, "role \u5FC5\u987B\u662F admin \u6216 user");
  const passcode = body.passcode !== void 0 ? String(body.passcode || "").trim() : void 0;
  if (passcode !== void 0 && passcode.length > 0 && passcode.length < 6) return err(400, "\u53E3\u4EE4\u81F3\u5C116\u4F4D");
  const updates = [];
  const params = [];
  if (role) {
    updates.push("role = ?");
    params.push(role);
  }
  if (passcode && passcode.length >= 6) {
    const salt = randomId(18);
    const hash = await pbkdf2Hash(passcode, salt);
    updates.push("pass_salt = ?");
    updates.push("pass_hash = ?");
    params.push(salt, hash);
  }
  if (updates.length === 0) return err(400, "\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u5B57\u6BB5");
  updates.push("updated_at = ?");
  params.push((/* @__PURE__ */ new Date()).toISOString());
  params.push(id);
  await dbRun(ctx.env.DB, `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  return json({ ok: true });
}, "onRequestPatch");
var onRequestDelete = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;
  const id = ctx.params.id;
  if (p.authenticated && p.id === id) return err(400, "\u4E0D\u80FD\u5220\u9664\u5F53\u524D\u767B\u5F55\u7528\u6237");
  const r = await dbRun(ctx.env.DB, "DELETE FROM users WHERE id = ?", [id]);
  await dbRun(ctx.env.DB, "DELETE FROM notes WHERE owner_id = ?", [id]);
  return json({ ok: true });
}, "onRequestDelete");
var onRequest = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "PATCH") return onRequestPatch(ctx);
  if (ctx.request.method === "DELETE") return onRequestDelete(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// api/admin/users.ts
function sanitizeRole2(role) {
  if (role === "admin" || role === "user") return role;
  return null;
}
__name(sanitizeRole2, "sanitizeRole");
var onRequestGet = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;
  const items = await dbAll(
    ctx.env.DB,
    "SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 500"
  );
  return json({
    items: items.map((u) => ({
      id: String(u.id),
      username: String(u.username),
      role: String(u.role),
      createdAt: String(u.created_at),
      updatedAt: String(u.updated_at)
    }))
  });
}, "onRequestGet");
var onRequestPost = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireRole(p, "admin");
  if (deny) return deny;
  const body = await readJson(ctx.request);
  const username = String(body.username || "").trim();
  const passcode = String(body.passcode || "").trim();
  const role = sanitizeRole2(String(body.role || "user"));
  if (!username || !passcode) return err(400, "\u7528\u6237\u540D\u548C\u53E3\u4EE4\u4E0D\u80FD\u4E3A\u7A7A");
  if (passcode.length < 6) return err(400, "\u53E3\u4EE4\u81F3\u5C116\u4F4D");
  if (!role) return err(400, "role \u5FC5\u987B\u662F admin \u6216 user");
  const exists = await dbOne(ctx.env.DB, "SELECT id FROM users WHERE username = ?", [username]);
  if (exists) return err(409, "\u7528\u6237\u540D\u5DF2\u5B58\u5728");
  const id = `user:${randomId(18)}`;
  const salt = randomId(18);
  const hash = await pbkdf2Hash(passcode, salt);
  const t = (/* @__PURE__ */ new Date()).toISOString();
  await dbRun(
    ctx.env.DB,
    "INSERT INTO users (id, username, role, pass_salt, pass_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, username, role, salt, hash, t, t]
  );
  return json({ ok: true }, { status: 201 });
}, "onRequestPost");
var onRequest2 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet(ctx);
  if (ctx.request.method === "POST") return onRequestPost(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// api/auth/login.ts
async function ensureBootstrapAdmin(env, username, passcode) {
  const anyUser = await dbOne(env.DB, "SELECT id FROM users LIMIT 1");
  if (anyUser) return null;
  if (!env.ADMIN_BOOTSTRAP_USER || !env.ADMIN_BOOTSTRAP_PASSCODE) return null;
  if (username !== env.ADMIN_BOOTSTRAP_USER || passcode !== env.ADMIN_BOOTSTRAP_PASSCODE) return null;
  const id = `user:${randomId(18)}`;
  const salt = randomId(18);
  const hash = await pbkdf2Hash(passcode, salt);
  const t = (/* @__PURE__ */ new Date()).toISOString();
  await dbRun(
    env.DB,
    "INSERT INTO users (id, username, role, pass_salt, pass_hash, created_at, updated_at) VALUES (?, ?, 'admin', ?, ?, ?, ?)",
    [id, username, salt, hash, t, t]
  );
  return { id, username, role: "admin" };
}
__name(ensureBootstrapAdmin, "ensureBootstrapAdmin");
var onRequestPost2 = /* @__PURE__ */ __name(async (ctx) => {
  const secure2 = new URL(ctx.request.url).protocol === "https:";
  try {
    const body = await readJson(ctx.request);
    if (body.mode === "guest") {
      const sub = newGuestSubject();
      const exp2 = Date.now() + 1e3 * 60 * 60 * 24 * 30;
      const token2 = await signToken(ctx.env, { sub, role: "guest", exp: exp2 });
      return json(
        { ok: true, role: "guest" },
        { headers: { "Set-Cookie": setAuthCookie(token2, secure2) } }
      );
    }
    const username = String(body.username || "").trim();
    const passcode = String(body.passcode || "").trim();
    if (!username || !passcode) return err(400, "\u7528\u6237\u540D\u548C\u53E3\u4EE4\u4E0D\u80FD\u4E3A\u7A7A");
    const boot = await ensureBootstrapAdmin(ctx.env, username, passcode);
    if (boot) {
      const exp2 = Date.now() + 1e3 * 60 * 60 * 24 * 30;
      const token2 = await signToken(ctx.env, { sub: boot.id, role: boot.role, username: boot.username, exp: exp2 });
      return json(
        { ok: true, role: boot.role, username: boot.username },
        { headers: { "Set-Cookie": setAuthCookie(token2, secure2) } }
      );
    }
    const user = await dbOne(
      ctx.env.DB,
      "SELECT id, username, role, pass_salt, pass_hash FROM users WHERE username = ?",
      [username]
    );
    if (!user) return err(401, "\u7528\u6237\u540D\u6216\u53E3\u4EE4\u9519\u8BEF");
    const hash = await pbkdf2Hash(passcode, user.pass_salt);
    if (hash !== user.pass_hash) return err(401, "\u7528\u6237\u540D\u6216\u53E3\u4EE4\u9519\u8BEF");
    const exp = Date.now() + 1e3 * 60 * 60 * 24 * 30;
    const token = await signToken(ctx.env, { sub: user.id, role: user.role, username: user.username, exp });
    return json(
      { ok: true, role: user.role, username: user.username },
      { headers: { "Set-Cookie": setAuthCookie(token, secure2) } }
    );
  } catch (e) {
    return err(400, e?.message || "\u8BF7\u6C42\u9519\u8BEF");
  }
}, "onRequestPost");
var onRequestGet2 = /* @__PURE__ */ __name(async () => {
  return err(405, "Method Not Allowed");
}, "onRequestGet");
var onRequest3 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost2(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return err(405, "Method Not Allowed");
}, "onRequest");

// api/auth/logout.ts
var onRequestPost3 = /* @__PURE__ */ __name(async () => {
  return json({ ok: true }, { headers: { "Set-Cookie": clearAuthCookie(secure) } });
}, "onRequestPost");
var onRequest4 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "POST") return onRequestPost3(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// api/notes/[id].ts
function fromRow(r) {
  return {
    id: String(r.id),
    title: String(r.title || ""),
    body: String(r.body || ""),
    tags: (() => {
      try {
        return JSON.parse(String(r.tags || "[]"));
      } catch {
        return [];
      }
    })(),
    done: !!r.done,
    pinned: !!r.pinned,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  };
}
__name(fromRow, "fromRow");
async function loadOwnedNote(env, noteId, principal) {
  const row = await dbOne(
    env.DB,
    "SELECT * FROM notes WHERE id = ?",
    [noteId]
  );
  if (!row) return { row: null, deny: err(404, "\u672A\u627E\u5230") };
  if (principal.role === "admin") return { row, deny: null };
  const ownerType = principal.role === "guest" ? "guest" : "user";
  if (row.owner_type !== ownerType || row.owner_id !== principal.id) {
    return { row: null, deny: err(403, "\u65E0\u6743\u9650") };
  }
  return { row, deny: null };
}
__name(loadOwnedNote, "loadOwnedNote");
var onRequestPut = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;
  const noteId = ctx.params.id;
  const { row, deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;
  const body = await readJson(ctx.request);
  const title = body.title !== void 0 ? String(body.title || "").trim() : String(row.title || "");
  const text = body.body !== void 0 ? String(body.body || "").trim() : String(row.body || "");
  const tags = body.tags !== void 0 ? Array.isArray(body.tags) ? body.tags.map(String).slice(0, 12) : [] : (() => {
    try {
      return JSON.parse(String(row.tags || "[]"));
    } catch {
      return [];
    }
  })();
  const done = body.done !== void 0 ? !!body.done : !!row.done;
  const pinned = body.pinned !== void 0 ? !!body.pinned : !!row.pinned;
  if (!title && !text) return err(400, "\u6807\u9898\u548C\u5185\u5BB9\u81F3\u5C11\u586B\u5199\u4E00\u4E2A");
  const t = (/* @__PURE__ */ new Date()).toISOString();
  await dbRun(
    ctx.env.DB,
    "UPDATE notes SET title = ?, body = ?, tags = ?, done = ?, pinned = ?, updated_at = ? WHERE id = ?",
    [title, text, JSON.stringify(tags), done ? 1 : 0, pinned ? 1 : 0, t, noteId]
  );
  const updated = await dbOne(ctx.env.DB, "SELECT * FROM notes WHERE id = ?", [noteId]);
  return json({ item: fromRow(updated) });
}, "onRequestPut");
var onRequestDelete2 = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;
  const noteId = ctx.params.id;
  const { deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;
  await dbRun(ctx.env.DB, "DELETE FROM notes WHERE id = ?", [noteId]);
  return json({ ok: true });
}, "onRequestDelete");
var onRequestGet3 = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny0 = requireAuth(p);
  if (deny0) return deny0;
  const noteId = ctx.params.id;
  const { row, deny } = await loadOwnedNote(ctx.env, noteId, p);
  if (deny) return deny;
  return json({ item: fromRow(row) });
}, "onRequestGet");
var onRequest5 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "PUT") return onRequestPut(ctx);
  if (ctx.request.method === "DELETE") return onRequestDelete2(ctx);
  if (ctx.request.method === "GET") return onRequestGet3(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// api/me.ts
var onRequestGet4 = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  if (!p.authenticated) return json({ authenticated: false, role: "none" });
  return json({ authenticated: true, id: p.id, role: p.role, username: p.username });
}, "onRequestGet");
var onRequest6 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet4(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// api/notes.ts
function toBoolInt(v) {
  return v ? 1 : 0;
}
__name(toBoolInt, "toBoolInt");
function fromRow2(r) {
  return {
    id: String(r.id),
    title: String(r.title || ""),
    body: String(r.body || ""),
    tags: (() => {
      try {
        return JSON.parse(String(r.tags || "[]"));
      } catch {
        return [];
      }
    })(),
    done: !!r.done,
    pinned: !!r.pinned,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  };
}
__name(fromRow2, "fromRow");
function sortSql(sort) {
  switch (sort) {
    case "updated_asc":
      return "pinned DESC, updated_at ASC";
    case "created_desc":
      return "pinned DESC, created_at DESC";
    case "created_asc":
      return "pinned DESC, created_at ASC";
    case "updated_desc":
    default:
      return "pinned DESC, updated_at DESC";
  }
}
__name(sortSql, "sortSql");
var onRequestGet5 = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireAuth(p);
  if (deny) return deny;
  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = (url.searchParams.get("filter") || "all").trim();
  const sort = (url.searchParams.get("sort") || "updated_desc").trim();
  let ownerType;
  let ownerId;
  if (p.role === "admin" && url.searchParams.get("owner")) {
    const o = url.searchParams.get("owner");
    if (o.startsWith("user:")) {
      ownerType = "user";
      ownerId = o;
    } else if (o.startsWith("guest:")) {
      ownerType = "guest";
      ownerId = o;
    } else {
      ownerType = "user";
      ownerId = o;
    }
  } else {
    ownerId = p.id;
    ownerType = p.role === "guest" ? "guest" : "user";
  }
  const where = ["owner_type = ? AND owner_id = ?"];
  const params = [ownerType, ownerId];
  if (filter === "active") where.push("done = 0");
  if (filter === "done") where.push("done = 1");
  if (filter === "pinned") where.push("pinned = 1");
  if (q) {
    where.push("(title LIKE ? OR body LIKE ? OR tags LIKE ?)");
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    params.push(like, like, like);
  }
  const sql = `
    SELECT id, title, body, tags, done, pinned, created_at, updated_at
    FROM notes
    WHERE ${where.join(" AND ")}
    ORDER BY ${sortSql(sort)}
    LIMIT 500
  `;
  const rows = await dbAll(ctx.env.DB, sql, params);
  return json({ items: rows.map(fromRow2) });
}, "onRequestGet");
var onRequestPost4 = /* @__PURE__ */ __name(async (ctx) => {
  const p = await getPrincipal(ctx);
  const deny = requireAuth(p);
  if (deny) return deny;
  const body = await readJson(ctx.request);
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 12) : [];
  const done = !!body.done;
  const pinned = !!body.pinned;
  if (!title && !text) return err(400, "\u6807\u9898\u548C\u5185\u5BB9\u81F3\u5C11\u586B\u5199\u4E00\u4E2A");
  const id = `note:${randomId(18)}`;
  const t = (/* @__PURE__ */ new Date()).toISOString();
  const ownerType = p.role === "guest" ? "guest" : "user";
  const ownerId = p.id;
  await dbRun(
    ctx.env.DB,
    `INSERT INTO notes (id, owner_type, owner_id, title, body, tags, done, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerType, ownerId, title, text, JSON.stringify(tags), toBoolInt(done), toBoolInt(pinned), t, t]
  );
  const item = { id, title, body: text, tags, done, pinned, createdAt: t, updatedAt: t };
  return json({ item }, { status: 201 });
}, "onRequestPost");
var onRequest7 = /* @__PURE__ */ __name(async (ctx) => {
  if (ctx.request.method === "GET") return onRequestGet5(ctx);
  if (ctx.request.method === "POST") return onRequestPost4(ctx);
  if (ctx.request.method === "OPTIONS") return json({ ok: true });
  return new Response("Method Not Allowed", { status: 405 });
}, "onRequest");

// ../.wrangler/tmp/pages-lVQkpt/functionsRoutes-0.5864006747696383.mjs
var routes = [
  {
    routePath: "/api/admin/users/:id",
    mountPath: "/api/admin/users",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/admin/users/:id",
    mountPath: "/api/admin/users",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch]
  },
  {
    routePath: "/api/admin/users/:id",
    mountPath: "/api/admin/users",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/notes/:id",
    mountPath: "/api/notes",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/notes/:id",
    mountPath: "/api/notes",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/notes/:id",
    mountPath: "/api/notes",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/notes/:id",
    mountPath: "/api/notes",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/api/me",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/me",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest6]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest7]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-GFSN0n/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-GFSN0n/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.19244514433745186.mjs.map
