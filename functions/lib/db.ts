export type Env = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_BOOTSTRAP_USER?: string;
  ADMIN_BOOTSTRAP_PASSCODE?: string;
};

export async function dbOne<T = any>(db: D1Database, sql: string, params: any[] = []) {
  const r = await db.prepare(sql).bind(...params).first<T>();
  return r ?? null;
}

export async function dbAll<T = any>(db: D1Database, sql: string, params: any[] = []) {
  const r = await db.prepare(sql).bind(...params).all<T>();
  return r.results as T[];
}

export async function dbRun(db: D1Database, sql: string, params: any[] = []) {
  return db.prepare(sql).bind(...params).run();
}
