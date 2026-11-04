import { appEnv, isProduction } from "@rallix/config/env";
import { join } from "node:path";
import { createStore, type ImageStore, type LocalStore } from "@rallix/media";

const g = globalThis as unknown as { __rallixStore?: ImageStore };
/** The configured picture store: a local folder in development, the Supabase bucket in production. */
export const store = (): ImageStore => (g.__rallixStore ??= createStore(appEnv(), join(process.cwd(), ".data", "media")));
// Compare by name, not instanceof: the same class can be bundled twice (server actions vs routes) and then instanceof is false.
export const localStore = (): LocalStore | null => { const s = store(); return s.name === "local" ? (s as LocalStore) : null; };
/** Pictures one person may upload per day (all kinds together). */
export const uploadLimit = () => Math.max(1, Number(process.env.UPLOAD_LIMIT_PER_DAY) || 20);
