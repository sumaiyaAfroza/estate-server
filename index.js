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
    const wishListCollection = db.collection("wishList");
    const reviewsCollection = db.collection("reviews");
    const offerCollection = db.collection("offers");
    const propertyCollection = db.collection("property");

    // get user role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "email is required" });
      }
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(404).send({ message: "user not found" });
      }
      res.send({ role: user.role || "user" });
    });

    // user er My profile
    app.get("/profile", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "Email required" });

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({
          name: user.name,
          image: user.image,
          role: user.role,
          email: user.email,
          phone: user.phone || "",
        });
      } catch (err) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // All properties
    app.get("/allProperties", async (req, res) => {
      const { location, sort } = req.query;
      const query = location
        ? { location: { $regex: location, $options: "i" } }
        : {};
      const sortOption =
        sort === "asc" ? { price: 1 } : sort === "desc" ? { price: -1 } : {};

      const result = await agentCollection
        .find(query)
        .sort(sortOption)
        .toArray();
      res.send(result);
    });

    // property Details
    app.get("/properties/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const property = await agentCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!property) {
          return res.status(404).json({ error: "Property not found" });
        }
        console.log(property);

        res.send(property);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch property" });
      }
    });

    //  register kora gular api
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

    // Get latest reviews
    app.get("/reviews/latest", async (req, res) => {
      try {
        const latestReviews = await reviewsCollection
          .find()
          .sort({ date: -1 }) // Sort by latest first
          .limit(3) // Only return top 3
          .toArray();

        res.send(latestReviews);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch latest reviews", error });
      }
    });

    // review post
    // Reviews API Endpoints

    // Add a new review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;

        // Validate required fields
        if (
          !review.propertyId ||
          !review.comment ||
          !review.reviewer ||
          !review.email
        ) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Add timestamp
        review.date = new Date();

        // Insert into database
        const result = await reviewsCollection.insertOne(review);

        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          review: review,
        });
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ error: "Failed to add review" });
      }
    });

    // Get reviews for a property
    app.get("/reviews", async (req, res) => {
      try {
        const propertyId = req.query.propertyId;

        if (!propertyId) {
          return res
            .status(400)
            .json({ error: "propertyId query parameter is required" });
        }

        const reviews = await reviewsCollection
          .find({ propertyId })
          .sort({ date: -1 }) // Sort by newest first
          .toArray();

        res.status(200).json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: "Failed to fetch reviews" });
      }
    });

    // my reviews er get email soho
    app.get("/myReviews", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const userReviews = await reviewsCollection
          .find({ email: email })
          .sort({ date: -1 }) // Show latest reviews first
          .toArray();

        res.send(userReviews);
      } catch (error) {
        res.status(500).send({ message: "Something went wrong", error });
      }
    });

    // Optional: Delete a review
    app.delete("/reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await reviewsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ message: "Review deleted successfully" });
        } else {
          res.status(404).send({ message: "Review not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to delete review", error });
      }
    });

    // Offer route
    app.post("/offers", async (req, res) => {
      try {
        const offer = req.body;

        // Validation: Only users can submit offers
        const buyerRole = offer.buyerRole;
        if (buyerRole !== "user") {
          return res
            .status(403)
            .send({ message: "Only users can make offers." });
        }

        // Validation: Check if offerAmount is within price range
        const { offerAmount, minPrice, maxPrice } = offer;
        if (offerAmount < minPrice || offerAmount > maxPrice) {
          return res
            .status(400)
            .send({ message: "Offer must be within the price range." });
        }

        // Add default status
        offer.status = "pending";

        const result = await offerCollection.insertOne(offer);
        res.send(result);
      } catch (error) {
        console.error("Error submitting offer:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    // offer
    app.get("/offers", async (req, res) => {
      try {
        const { email, role } = req.query;

        if (!email || !role) {
          return res
            .status(400)
            .json({ message: "Email and role are required" });
        }

        const query = { buyerEmail: email, buyerRole: role };
        const offers = await offerCollection.find(query).toArray();

        res.send(offers);
      } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });






    // admin==============

    // Get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    // Update user role
    app.patch("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        const { role } = req.body;

        if (!["admin", "agent", "user"].includes(role)) {
          return res.status(400).json({ error: "Invalid role" });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        res.send({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to update user role" });
      }
    });

    // Mark user as fraud
    app.patch("/users/:email/fraud", async (req, res) => {
      try {
        const email = req.params.email;

        // Start a transaction
        const session = client.startSession();

        try {
          await session.withTransaction(async () => {
            // 1. Mark user as fraud
            const userResult = await usersCollection.updateOne(
              { email },
              { $set: { fraud: true, role: "user" } },
              { session }
            );

            if (userResult.matchedCount === 0) {
              throw new Error("User not found");
            }

            // 2. Delete all properties by this agent
            await agentCollection.deleteMany(
              { agentEmail: email },
              { session }
            );
          });

          res.send({ success: true });
        } finally {
          await session.endSession();
        }
      } catch (error) {
        res
          .status(500)
          .json({ error: error.message || "Failed to mark as fraud" });
      }
    });

    // Delete user
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        res.send({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete user" });
      }
    });

    // Delete Firebase user (this would be handled by a Firebase Cloud Function)
    // You'll need to create a separate endpoint that calls Firebase Admin SDK
    app.delete("/firebaseUser/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // In a real implementation, you would call Firebase Admin SDK here
        // This is just a placeholder - you'll need to implement the actual Firebase deletion

        res.send({
          success: true,
          message: `Firebase user ${email} would be deleted in production`,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete Firebase user" });
      }
    });



    // manage properties
    // Get all properties for admin management   
app.get('/properties',async(req,res)=>{
  const result = await agentCollection.find().toArray()
  res.send(result)
})


app.patch("/properties/verify/:id", async (req, res) => {
  try {
    const id = req.params.id;
    
    // Update in propertyCollection
    const result = await agentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "verified", verified: true } }
    );

    // console.log(result);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Property not found" });
    }

    // Also update in agentCollection
    await agentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "verified", verified: true } }
    );

    res.send({ 
      success: true,
      message: "Property verified successfully"
    });
  } catch (error) {
    console.error("Error verifying property:", error);
    res.status(500).send({ message: "Failed to verify property" });
  }
});

// Reject a property
app.patch("/properties/reject/:id", async (req, res) => {
  try {
    const id = req.params.id;
    
    const result = await agentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "rejected", verified: false } }
    );

    console.log(result);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Property not found" });
    }

    // Also update in agentCollection
    await agentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "rejected", verified: false } }
    );

    res.send({ 
      success: true,
      message: "Property rejected successfully"
    });
  } catch (error) {
    console.error("Error rejecting property:", error);
    res.status(500).send({ message: "Failed to reject property" });
  }
});

    
    // user=========================
    // make offer er id
    // Add this route to your server code
    app.get("/wishlistProperty/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const property = await agentCollection.findOne({
          _id: new ObjectId(id),
        });

        console.log(property);
        if (!property) {
          return res.status(404).json({ error: "Property not found" });
        }
        res.send(property);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch property" });
      }
    });

    // POST: Add to Wishlist
    app.post("/wishlist", async (req, res) => {
      const wishlistItem = req.body;
      const result = await wishListCollection.insertOne(wishlistItem);
      res.send(result);
    });

    // GET: Wishlist by user email
    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      const result = await wishListCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // DELETE: Remove wishlist item by id
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishListCollection.deleteOne({
        _id: new ObjectId(id),
      });
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



    // add property er form post
    // Update the add property endpoint
app.post("/addProperty", async (req, res) => {
    const propertyData = req.body;
    console.log(propertyData);

    // Validate required fields
    if (!propertyData.title || !propertyData.location || !propertyData.imageUrl || 
        !propertyData.agentEmail || !propertyData.price) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields" 
      });
    }

  //   // Ensure price is properly formatted
    if (typeof propertyData.price !== 'object' || 
        !propertyData.price.min || !propertyData.price.max) {
      return res.status(400).json({
        success: false,
        error: "Invalid price format"
      });
    }

  //   // Set default values
    propertyData.status = "pending";
    propertyData.verified = false;
    propertyData.createdAt = new Date();

  //   // Insert into both collections
    const [agentResult, propertyResult] = await Promise.all([
      agentCollection.insertOne(propertyData),
      propertyCollection.insertOne(propertyData)
    ]);

    res.status(201).json({
      success: true,
      agentInsertedId: agentResult.insertedId,
      propertyInsertedId: propertyResult.insertedId
    });
  // } catch (error) {
  //   console.error("Error adding property:", error);
  //   res.status(500).json({ 
  //     success: false,
  //     error: error.message 
  //   });
  // }
});




    // agent property delete
    app.delete("/property/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await agentCollection.deleteOne({ _id: id });
      res.send(result);
    });

    //agent property update er get
    app.get("/property/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await agentCollection.findOne({ _id: id });
      res.send(result);
    });

    // update jonno
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

    // ---
    // requested property
    app.get("/offers/agent", async (req, res) => {
      const { email } = req.query;
      try {
        const result = await offerCollection
          .find({ agentEmail: email })
          .toArray();
        console.log(result);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch offers" });
      }
    });

    // PATCH: Accept an offer
    app.patch("/offers/accept/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { propertyId } = req.body;

        // Validate input
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid offer ID" });
        }

        // Update offer status to accepted
        const result = await offerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "accepted" } }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Offer not found" });
        }

        // Optionally update property status if needed
        if (propertyId) {
          await agentCollection.updateOne(
            { _id: new ObjectId(propertyId) },
            { $set: { status: "sold" } }
          );
        }

        res.send({
          success: true,
          message: "Offer accepted successfully",
        });
      } catch (error) {
        console.error("Error accepting offer:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // PATCH: Reject an offer
    app.patch("/offers/reject/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // Validate input
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid offer ID" });
        }

        // Update offer status to rejected
        const result = await offerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "rejected" } }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Offer not found" });
        }

        res.send({
          success: true,
          message: "Offer rejected successfully",
        });
      } catch (error) {
        console.error("Error rejecting offer:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
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
