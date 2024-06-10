const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.HIDDEN_INFORMATION);
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;


//middleware 
app.use(cors());
app.use(express.json());

const verifyToken = (req, res, next) => {
  //console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'forbidden access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  // console.log( 'taken by headers',token)
  // console.log('env token', process.env.SECRET_KEY)
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}

//mongoDb connect
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.khblnbj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('medCoordDB').collection('users');
    const successCollection = client.db('medCoordDB').collection('successStory');
    const campCollection = client.db('medCoordDB').collection('allCamps');
    const participantCollection = client.db('medCoordDB').collection('participantCamps');
    const reviewCollection = client.db('medCoordDB').collection('reviews');
    const paymentCollection = client.db('medCoordDB').collection('histories');

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    //jwt api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: '1h' });
      res.send({ token });
    })
    //data related api
    //users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    //data related api
    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req?.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    })
    //post users data
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(400).send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })
    //updated user data 
    app.patch('/users/:id', verifyToken, async (req, res) => {
      const updatedInfo = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          name: updatedInfo?.name,
          image: updatedInfo?.image
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, option);
      res.send(result)
    })
    //make user as admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    //Check user is admin or not 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req?.decoded?.email) {
        return res.status(403).send({ message: 'Unauthorized access' });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        if (user?.role === 'admin') {
          admin = true;
        }
      }
      res.send({ admin });
    })

    // Delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })
    //all camps
    //get popular
    app.get('/allCamps', async (req, res) => {
      try {
        const { search = '', sortBy = 'date', order = 'asc', limit, popular = false, email = '' } = req.query;

        // Convert limit to integer
        const limitInt = limit ? parseInt(limit, 10) : 1000;

        // Define sorting order
        const sortOrder = order === 'asc' ? 1 : -1;

        const validSortFields = ['campName', 'date', 'participantCount', 'campFees'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
        // Create a search query
        let query = {
          $or: [
            { campName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
            { healthcareProfessional: { $regex: search, $options: 'i' } },
            { date: { $regex: search, $options: 'i' } }
          ]
        };
        if (email) {
          query = {
            $and: [
              query,
              { organizerEmail: email }
            ]
          };
        }

        // Conditional sorting for popular camps
        let sortCriteria = {};
        if (sortBy === 'mostRegistered') {
          sortCriteria = { participantCount: -1 };
        } else if (sortBy === 'campFees') {
          sortCriteria = { campFees: sortOrder };
        } else if (sortBy === 'campName') {
          sortCriteria = { campName: sortOrder };
        } else {
          sortCriteria = { [sortField]: sortOrder };
        }

        if (popular) {
          sortCriteria = { participantCount: -1 };
        }

        // Aggregate query with search, sort, and limit
        const result = await campCollection.aggregate([
          { $match: query },
          // { $addFields: { participantCount: { $toInt: '$participantCount' }, campFees: { $toInt: '$campFees' } } },
          { $sort: sortCriteria },
          { $limit: limitInt }
        ]).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching camps with query parameters");
      }
    });
    //Camps
    app.post('/allCamps', async (req, res) => {
      const camp = req.body;
      const result = await campCollection.insertOne(camp);
      res.send(result);
    })

    //get single camp data
    app.get('/allCamps/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.findOne(query);
      res.send(result);
    })
    //patch
    app.patch('/allCamps/:id', async (req, res) => {
      const updatedInfo = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          participantCount: updatedInfo?.participantCount,
        }
      };
      const result = await campCollection.updateOne(filter, updatedDoc, option);
      res.send(result);
    })
    //update campDetails
    app.put('/allCamps/:id', async (req, res) => {
      const updatedInfo = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          campFees: updatedInfo?.campFees,
          participantCount: updatedInfo?.participantCount,
          campName: updatedInfo?.campName,
          location: updatedInfo?.location,
          date: updatedInfo?.date,
          description: updatedInfo?.description,
          organizerEmail: updatedInfo?.organizerEmail,
          organizer: updatedInfo?.organizer,
          healthcareProfessional: updatedInfo?.healthcareProfessional,
          image: updatedInfo?.image
        }
      };
      const result = await campCollection.updateOne(filter, updatedDoc, option);
      res.send(result);
    })
    //dele camp details
    app.delete('/allCamps/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.deleteOne(query);
      res.send(result);
    })
    //participant Camp api
    //get all  participated camp data 
    app.get('/participantCamps',verifyToken, async (req, res) => {
      const email = req.query.email;
      let query = {};
      if(email) {
        query = {participantEmail: email};
      } 
      const result = await participantCollection.find(query).toArray();
      res.send(result);
    })
    //get  registered data for user who registered
    app.get('/participantCamps/:id', async (req, res)=>{
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const result = await participantCollection.findOne(query);
          res.send(result)
    })
    //post
    app.post('/participantCamps', async (req, res) => {
      const participant = req.body;
      const result = await participantCollection.insertOne(participant);
      res.send(result);
    })
    //fetch participant data
    app.patch(`/participantCamps/:id`, async (req,res) => {
            const updatedStatus = req.body;
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const option = {upsert: true};
            const updatedDoc = {
              $set:{
                paymentStatus: "Paid"
              }
            }
            const result = await participantCollection.updateOne(filter,updatedDoc,option);
            res.send(result);
    })

    //participant camp data delete operation
    app.delete('/participantCamps/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await participantCollection.deleteOne(query);
      res.send(result)
    })
    //success story
    app.get('/successStory', async (req, res) => {
      const result = await successCollection.find().toArray();
      res.send(result)
    })
    // review of experience
    app.post('/reviews', async(req,res) => {
             const  review = req.body;
             const result = await reviewCollection.insertOne(review);
             res.send(result);
    })
    //payment related api 
    app.post('/create-payment-intent', async (req,res) => {
            const {price} = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: 'usd',
              payment_method_types: ['card']
            });

            res.send({
              clientSecret: paymentIntent.client_secret
            })
    })

    //for payment history
    app.post('/histories', async(req,res) => {
            const history = req.body;
            const result = await paymentCollection.insertOne(history);
            res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Final-Assignment-Server is Running");
})
app.listen(port, () => {
  console.log(`Final-Assignment-Server is Running on port ${port}`);
})