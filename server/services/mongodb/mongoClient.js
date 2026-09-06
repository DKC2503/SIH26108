import { MongoClient } from 'mongodb';

let clientInstance = null;
let dbInstance = null;
let mongoStatus = "unavailable";
let isConnecting = false;

const DB_NAME = process.env.MONGODB_DB || "BIS_Standards";

/**
 * Singleton MongoClient management.
 * Connects once at server startup with a strict fast timeout.
 * Reuses client instance and connection pool across all requests.
 */
export async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    mongoStatus = "unavailable";
    return null;
  }

  if (clientInstance && dbInstance) {
    return { client: clientInstance, db: dbInstance };
  }

  if (isConnecting) return null;
  isConnecting = true;

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 1
    });

    await client.connect();
    await client.db("admin").command({ ping: 1 });

    clientInstance = client;
    dbInstance = client.db(DB_NAME);
    mongoStatus = "connected";
    console.log(`[MongoDB] CONNECTED — Pool initialized for database '${DB_NAME}'`);
    isConnecting = false;
    return { client: clientInstance, db: dbInstance };
  } catch (err) {
    isConnecting = false;
    mongoStatus = "unavailable";
    // Never expose raw stack trace or URI
    console.log(`[MongoDB] Atlas offline (fast fail in < 3s). Using local in-memory standards.`);
    return null;
  }
}

export function isMongoConnected() {
  return mongoStatus === "connected" && dbInstance !== null;
}

export function getMongoStatus() {
  return mongoStatus;
}

export function getStandardsCollection() {
  if (isMongoConnected()) {
    return dbInstance.collection("standards");
  }
  return null;
}
