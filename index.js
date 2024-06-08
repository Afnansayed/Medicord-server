const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


//middleware 
app.use(cors());
app.use(express.json());

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
    //users
    app.get('/users/:email', async(req,res) => {
         const email = req?.params.email;
         const query = {email: email};
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
    app.patch('/users/:id',async(req,res) => {
          const  updatedInfo = req.body;
          const id = req.params.id;
          const filter = {_id: new ObjectId(id)};
          const option = {upsert: true};
          const updatedDoc = {
            $set: {
              name: updatedInfo?.name,
              image: updatedInfo?.image
            }
          }
          const result = await usersCollection.updateOne(filter,updatedDoc,option);
          res.send(result)
    })
    //all camps
    //get popular
    app.get('/allCamps', async (req, res) => {
      try {
        const { search = '', sortBy = 'date', order = 'asc', limit, popular = false } = req.query;

        // Convert limit to integer
        const limitInt = limit ? parseInt(limit, 10) : 1000;

        // Define sorting order
        const sortOrder = order === 'asc' ? 1 : -1;

        const validSortFields = ['campName', 'date', 'participantCount', 'campFees'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
        // Create a search query
        const query = {
          $or: [
            { campName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
            { healthcareProfessional: { $regex: search, $options: 'i' } },
            { date: { $regex: search, $options: 'i' } }
          ]
        };

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
    app.get('/allCamps/:id', async(req,res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await campCollection.findOne(query);
            res.send(result); 
    })
    //patch
    app.patch('/allCamps/:id', async(req,res) => {
            const updateCount = req.body;
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const option = {upsert: true};
            const updatedDoc = {
              $set: {
                  participantCount: updateCount.participantCount,
              }
            };
            const result = await campCollection.updateOne(filter,updatedDoc,option);
            res.send(result);
    })
    //participant Camp
    app.post('/participantCamps', async (req,res) => {
        const participant = req.body;
        const result = await participantCollection.insertOne(participant);
        res.send(result);
    })
    //success story
    app.get('/successStory', async (req, res) => {
      const result = await successCollection.find().toArray();
      res.send(result)
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