require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-key.json");

const app = express();
const port = process.env.PORT || 3000;

// MIddle ware
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

    // jwt token
    const verifyFireBaseToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      // console.log(authHeader)
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        console.log(error);
      }
    };
    // verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // admin route er dashboard
    // Assuming Express.js, MongoDB client, and collections are set up.
// fraud btn id dore
app.patch("/users/:id/fraud", verifyFireBaseToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Mark user as fraud
    const userUpdateResult = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { fraud: true } }
    );

    // Remove all properties added by this agent
    // Assumes properties have a 'agentId' field that matches user's _id as string
    const propertiesDeleteResult = await agentCollection.deleteMany({
      agentId: id,
    });

    res.send({
      message: "User marked as fraud and properties deleted",
      userUpdateResult,
      propertiesDeleteResult,
    });
  } catch (error) {
    console.error("Error marking user as fraud", error);
    res.status(500).send({ message: "Failed to mark user as fraud" });
  }
});
// fraud btn jonno
app.post("/properties", verifyFireBaseToken, async (req, res) => {
  const { agentId, ...propertyData } = req.body;

  // Check if agent is fraud
  const user = await usersCollection.findOne({ _id: new ObjectId(agentId) });

  if (user?.fraud) {
    return res
      .status(403)
      .send({ message: "Agent is marked as fraud and cannot add properties." });
  }

  // proceed with adding property
  const result = await agentCollection.insertOne({ agentId, ...propertyData });
  res.send({ message: "Property added", result });
});




    // admin role set korar jonno
    app.patch("/users/:id/role", verifyFireBaseToken, async (req, res) => {
      const { id } = req.params;
        const { role } = req.body;

        if (!["admin","agent", "user"].includes(role)) {
          return res.status(400).send({ message: "Invalid role" });
        }

        try {
          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role } }
          );
          res.send({ message: `User role updated to ${role}`, result });
        } catch (error) {
          console.error("Error updating user role", error);
          res.status(500).send({ message: "Failed to update user role" });
        }
      }
    );
    // get user role by email - useUserRole er email disi tai
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
      // Always filter for verified properties
      const query = {
        status: "verified",
        verified: true,
        ...(location ? { location: { $regex: location, $options: "i" } } : {})
      };
      // const query = location
      //   ? { location: { $regex: location, $options: "i" } }
      //   : {};
      const sortOption =
        sort === "asc" ? { price: 1 } : sort === "desc" ? { price: -1 } : {};

      const result = await agentCollection
        .find( query ,{status: "verified",verified: true,})
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
        // console.log(property);

        res.send(property);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch property" });
      }
    });

    // home er advertise
    // Get verified properties
    app.get("/properties/verified", async (req, res) => {
      try {
        const verified = await agentCollection
          .find({ verified: true })
          .toArray();
        res.send(verified);
      } catch (error) {
        console.error("Error fetching verified properties:", error);
        res
          .status(500)
          .send({ message: "Failed to fetch verified properties" });
      }
    });

    // Patch advertise status
    app.patch("/properties/advertise/:id", async (req, res) => {
      try {
        const result = await agentCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { isAdvertised: true } }
        );
        res.send(result);
      } catch (error) {
        console.error("Advertise error:", error);
        res.status(500).send({ message: "Failed to advertise property" });
      }
    });
    // Replace the existing /properties/advertised endpoint with this:
    app.get("/propertiess/advertised", async (req, res) => {
      try {
        // Get advertised properties from agentCollection (where properties are actually stored)===============
        const advertised = await agentCollection
          .find({
            isAdvertised: true,
            verified: true,
            status: "verified", // or "approved" depending on your schema
          })
          .sort({ createdAt: -1 }) // Sort by latest first
          .limit(4) // Only return top 3
          .toArray();

        // Transform data to match frontend expectations
        const transformed = advertised.map((property) => ({
          _id: property._id,
          title: property.title,
          location: property.location,
          price: `${property.price.min} - ${property.price.max}`,
          image: property.imageUrl, // Frontend expects 'image' but we have 'imageUrl'
          verified: property.verified,
          agentName: property.agentName,
        }));

        res.send(transformed);
      } catch (error) {
        console.error("Advertised properties error:", error);
        res.status(500).send({
          message: "Failed to fetch advertised properties",
          error: error.message,
        });
      }
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

    // my reviews er get email soho                     ============================verifyFBToken
    app.get("/myReviews", verifyFireBaseToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }

        // console.log(email,'email');
        // console.log('decoded', req.decoded);

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
    // offer                                                   ======================verify
    app.get("/offers", verifyFireBaseToken, async (req, res) => {
      try {
        const { email, role } = req.query;

        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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





    // Get all users
    app.get("/users",verifyFireBaseToken,verifyAdmin, async (req, res) => {
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

    // admin er manage review
    app.get("/allReviews", async (req, res) => {
      try {
        const reviews = await reviewsCollection.find().toArray();
        // console.log(reviews);

        res.send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(400).json({ error: "Failed to fetch reviews" });
      }
    });

    // manage properties
    // Get all properties for admin management
    app.get("/properties", async (req, res) => {
      const result = await agentCollection.find().toArray();
      res.send(result);
    });

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
          message: "Property verified successfully",
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

        // console.log(result);

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
          message: "Property rejected successfully",
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

        // console.log(property);

        if (!property) {
          return res.status(404).json({ error: "Property not found" });
        }
        res.send(property);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch property" });
      }
    });

    // POST: Add to Wishlist=-.................................................
   app.post("/wishlist", async (req, res) => {
  const wishlistItem = req.body;
  const { email, propertyId } = wishlistItem;

  try {
    // 🔍 Convert propertyId to ObjectId if it's a valid id
    const existing = await wishListCollection.findOne({
      email,
      propertyId: new ObjectId(propertyId),
    });

    if (existing) {
      return res.status(400).send({
        success: false,
        message: "Sorry, this property is already in your wishlist.",
      });
    }

    // ✅ Save original propertyId as ObjectId to be consistent
    wishlistItem.propertyId = new ObjectId(propertyId);

    const result = await wishListCollection.insertOne(wishlistItem);
    res.send({
      success: true,
      message: "Added to wishlist successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Wishlist insert error:", error);
    res.status(500).send({ success: false, message: "Server error" });
  }
});

    // GET: Wishlist by user email
    app.get("/wishlist", verifyFireBaseToken, async (req, res) => {
      const email = req.query.email;
      // console.log(email, req.decoded.email);

      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

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
    app.get("/myAddedProperty", verifyFireBaseToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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
      // console.log(propertyData);

      // Validate required fields
      if (
        !propertyData.title ||
        !propertyData.location ||
        !propertyData.imageUrl ||
        !propertyData.agentEmail ||
        !propertyData.price
      ) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      //   // Ensure price is properly formatted
      if (
        typeof propertyData.price !== "object" ||
        !propertyData.price.min ||
        !propertyData.price.max
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid price format",
        });
      }

      //   // Set default values
      propertyData.status = "pending";
      propertyData.verified = false;
      propertyData.createdAt = new Date();

      //   // Insert into both collections
      const [agentResult, propertyResult] = await Promise.all([
        agentCollection.insertOne(propertyData),
        propertyCollection.insertOne(
          propertyData
        ) /**========*****===========propertyCollection  insertOne */,
      ]);

      res.status(201).json({
        success: true,
        agentInsertedId: agentResult.insertedId,
        propertyInsertedId: propertyResult.insertedId,
      });
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
    app.get("/offers/agent",verifyFireBaseToken, async (req, res) => {
      const { email } = req.query;

if(req.decoded.email !== email){
        return  res.status(403).send({ message: 'forbidden access' })
      }

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
            { $set: { status: "bought" } }
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

    // Add this new route to your server code after the existing payment routes

    // Update offer status to bought after payment
    app.put("/offer/:id/buy", async (req, res) => {
      try {
        const { id } = req.params;
        const { transactionId } = req.body;

        const result = await offerCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "bought",
              transactionId,
              paidAt: new Date(),
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Offer not found" });
        }

        res.json({
          success: true,
          message: "Offer status updated successfully",
        });
      } catch (error) {
        console.error("Error updating offer:", error);
        res.status(500).json({ error: "Failed to update offer status" });
      }
    });

    // Update the existing property payment route to also update offer
    app.put("/property/:id/pay", async (req, res) => {
      try {
        const { id } = req.params;
        const { transactionId, offerId } = req.body;

        // Update property status
        const propertyResult = await Promise.all([
          agentCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "sold", transactionId, soldAt: new Date() } }
          ),
          propertyCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: { status: "sold", transactionId, soldAt: new Date() },
            } /*================propertyCollection*/
          ),
        ]);

        // Update offer status to bought if offerId provided
        if (offerId) {
          await offerCollection.updateOne(
            { _id: new ObjectId(offerId) },
            {
              $set: {
                status: "bought",
                transactionId,
                paidAt: new Date(),
              },
            }
          );
        }

        if (propertyResult[0].matchedCount === 0) {
          return res.status(404).json({ error: "Property not found" });
        }

        res.json({ success: true, message: "Payment recorded successfully" });
      } catch (error) {
        console.error("Error recording payment:", error);
        res.status(500).json({ error: "Failed to record payment" });
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
    // --------
    // GET /sold-properties?agentEmail=agent@gamil.com
    app.get("/sold-properties",verifyFireBaseToken, async (req, res) => {
      const agentEmail = req.query.agentEmail;

if(req.decoded.email !== agentEmail){
        return  res.status(403).send({ message: 'forbidden access' })
      }

      const sold = await offerCollection
        .find({
          agentEmail,
          status: "bought", // Only paid offers
        })
        .toArray();

      console.log(sold);

      res.send(sold);
    });

    // stripe
    // Create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amountInCents, propertyId } = req.body;
        console.log(amountInCents, propertyId);

        if (!amountInCents || !propertyId) {
          return res
            .status(400)
            .json({ error: "Amount and propertyId required" });
        }

        const property = await agentCollection.findOne({
          _id: new ObjectId(propertyId),
        });

        console.log(property);

        if (!property) {
          return res.status(404).json({ error: "Property not found" });
        }

        // if (property.status === 'sold') {
        //   console.log(property.status);

        //   return res.status(400).json({ error: 'Property already sold' });
        // }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
          metadata: { propertyId },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ error: "Failed to create payment intent" });
      }
    });


    // Update property payment status
    // app.put("/property/:id/pay", async (req, res) => {
    //   try {
    //     const { id } = req.params;
    //     const { transactionId } = req.body;

    //     const result = await Promise.all([
    //       agentCollection.updateOne(
    //         { _id: new ObjectId(id) },
    //         { $set: { status: "sold", transactionId, soldAt: new Date() } }
    //       ),
    //       propertyCollection.updateOne(
    //         { _id: new ObjectId(id) },
    //         {
    //           $set: { status: "sold", transactionId, soldAt: new Date() },
    //         } /**======propertycollection */
    //       ),
    //     ]);

    //     if (result[0].matchedCount === 0) {
    //       return res.status(404).json({ error: "Property not found" });
    //     }

    //     res.json({ success: true, message: "Payment recorded successfully" });
    //   } catch (error) {
    //     console.error("Error recording payment:", error);
    //     res.status(500).json({ error: "Failed to record payment" });
    //   }
    // });

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
