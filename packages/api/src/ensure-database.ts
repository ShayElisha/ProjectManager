import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const EMBEDDED_PORT = 27027;
const DB_NAME = "nexus_project";
const REPLICA_SET = "rs0";

let replSet: MongoMemoryReplSet | undefined;
let startedByProcess = false;

function embeddedUrl(): string {
  return `mongodb://127.0.0.1:${EMBEDDED_PORT}/${DB_NAME}?replicaSet=${REPLICA_SET}`;
}

async function pingEmbeddedMongo(): Promise<boolean> {
  const client = new MongoClient(embeddedUrl(), { serverSelectionTimeoutMS: 1500 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => undefined);
  }
}

function clearStaleLock(dataDir: string) {
  const lock = resolve(dataDir, "mongod.lock");
  if (existsSync(lock)) {
    try {
      unlinkSync(lock);
    } catch {
      /* another process holds the lock */
    }
  }
}

/** Starts or reuses embedded MongoDB replica set when no Atlas/hosted URL is configured. */
export async function ensureDatabaseUrl(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (url.startsWith("mongodb+srv://") || url.includes("mongodb.net")) return;
  if (process.env.USE_EMBEDDED_MONGO !== "true") return;

  if (await pingEmbeddedMongo()) {
    process.env.DATABASE_URL = embeddedUrl();
    return;
  }

  const dataDir = resolve(__dirname, "../data/mongo");
  clearStaleLock(dataDir);

  replSet = await MongoMemoryReplSet.create({
    instanceOpts: [
      {
        dbPath: dataDir,
        storageEngine: "wiredTiger",
        port: EMBEDDED_PORT,
      },
    ],
    replSet: {
      count: 1,
      name: REPLICA_SET,
      dbName: DB_NAME,
      storageEngine: "wiredTiger",
      ip: "127.0.0.1",
    },
  });
  await replSet.waitUntilRunning();
  startedByProcess = true;

  process.env.DATABASE_URL = embeddedUrl();
}

export async function stopEmbeddedDatabase(): Promise<void> {
  if (startedByProcess) await replSet?.stop();
}
