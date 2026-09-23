const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set in environment variables");

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connect() {
  await client.connect();
  const db = client.db("Estate-db");

  return {
    db,
    client,
    collections: {
      users: db.collection("users"),
      agents: db.collection("agents"),
      wishList: db.collection("wishList"),
      reviews: db.collection("reviews"),
      offers: db.collection("offers"),
      property: db.collection("property"),
      appointments: db.collection("appointments"),
    },
    ObjectId,
  };
}

module.exports = { connect };
