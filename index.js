const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


//middleware 
app.use(cors());
app.use(express.json());

//mongoDb connect
const { MongoClient, ServerApiVersion } = require('mongodb');
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
    //users
    app.post('/users', async(req,res) => {
           const user = req.body;
           const query = {email: user?.email}
           const existingUser = await usersCollection.findOne(query);
           if(existingUser){
              return res.status(400).send({ message: "User already exists" });
           }
           const result = await usersCollection.insertOne(user);
           res.send(result);
    })
    //Camps
    app.post('/allCamps',async(req,res) => {
           const camp = req.body;
           const result = await campCollection.insertOne(camp);
           res.send(result);
    })
    //success story
    app.get('/successStory',async (req,res) => {
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


app.get('/', (req,res) => {
    res.send("Final-Assignment-Server is Running");
})
app.listen(port, () => {
    console.log(`Final-Assignment-Server is Running on port ${port}`);
})