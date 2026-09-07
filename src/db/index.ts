import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __db?: Db;
};

/** Khởi tạo lười: build không cần DATABASE_URL, chỉ query mới cần. */
function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL");

  const sql = globalForDb.__sql ?? postgres(url, { max: 3, idle_timeout: 20, prepare: false });
  const instance = drizzle(sql, { schema });

  globalForDb.__sql = sql;
  globalForDb.__db = instance;
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    // bind về instance thật để drizzle không mất private field.
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
