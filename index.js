require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// MIddle ware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nkqgssx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.SECRET_KEY}@cluster0.a3jeczi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("Estate-db");
    const usersCollection = db.collection("users");
    const agentCollection = db.collection("agents");

// All properties
     app.get('/allProperties',async(req,res)=>{
        const all = req.query
        const result = await agentCollection.find(all).toArray()
        res.send(result)
     })
     




    // user=========================
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(200).send({ message: "user already exists" });
      }
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // agents site ===================

    // ✅ Get properties by agent email (My Added Properties)
    app.get("/myAddedProperty", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email query is required" });
        }

        const result = await agentCollection
          .find({ agentEmail: email })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.post("/addProperty", async (req, res) => {
      try {
        const add = req.body;
        const result = await agentCollection.insertOne(add);
        res.send(result);
        // res.status(201).json({_id: result.insertedId})
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete("/property/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await agentCollection.deleteOne({ _id: id });
      res.send(result);
    });

    //  update er get
    app.get("/property/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await agentCollection.findOne({ _id: id });
      res.send(result);
    });

    app.put("/property/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const updateDoc = {
        $set: {
          title: req.body.title,
          location: req.body.location,
          price: req.body.price,
          imageUrl: req.body.imageUrl,
        },
      };
      const result = await agentCollection.updateOne({ _id: id }, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello estate properties");
});
app.listen(port, () => {
  console.log(`server ok, ${port}`);
});
