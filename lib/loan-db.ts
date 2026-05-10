import { MongoClient, Db } from 'mongodb';

declare global {
  var _loanMongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV !== 'production') {
  if (!global._loanMongoClientPromise) {
    global._loanMongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._loanMongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'loan_app');
}

export async function nextId(col: string): Promise<number> {
  const db = await getDb();
  const res = await db
    .collection<{ _id: string; seq: number }>('counters')
    .findOneAndUpdate(
      { _id: col },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  return res!.seq;
}

export { clientPromise };
export default clientPromise;
