/** @deprecated Use DataStoreService — kept for backward compat during migration */
import { InMemoryBackend } from "../database/in-memory.backend";

export const store = new InMemoryBackend();
