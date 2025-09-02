import { MongoClient, Db } from "mongodb";
import { env } from "~/env";
import type { Task } from "./schema";
import { collections } from "./schema";

const globalForDb = globalThis as unknown as {
  client: MongoClient | undefined;
  db: Db | undefined;
};

let client: MongoClient;
let db: Db;

if (env.NODE_ENV === "production") {
  client = new MongoClient(env.DATABASE_URL);
  db = client.db();
} else {
  if (!globalForDb.client) {
    globalForDb.client = new MongoClient(env.DATABASE_URL);
  }
  client = globalForDb.client;
  
  if (!globalForDb.db) {
    globalForDb.db = client.db();
  }
  db = globalForDb.db;
}

export { db, client };

export const tasksCollection = db.collection<Task>(collections.tasks);