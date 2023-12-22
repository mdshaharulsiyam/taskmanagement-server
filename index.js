const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000
const cors = require('cors')
require('dotenv').config()
const stripe = require("stripe")(process.env.SRTIPE_KEY)
// middleware
app.use(express.json())
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
  optionSuccessStatus: 200
}));
app.use(cookieParser())
// database cunnection 
const client = new MongoClient(`${process.env.DB_URI}`, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// cullections 
const users = client.db("YourTask").collection("users")
const task = client.db("YourTask").collection("task")
// verify jwt 
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCES_TOCKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' })
    }
    req.user = decoded;
    next();
  })
}
async function run() {
  try {
    // jwt 
    // add user token
    app.post('/jwt', async (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.ACCES_TOCKEN_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
        .send({ succes: true })
    })
    // clear user token
    app.post('/clearjwt', async (req, res) => {
      res.clearCookie('tocken', { maxAge: 0 })
        .send({ succes: true })
    })

    // users
    // post suers data //require('crypto').randomBytes(16).toString('hex')
    app.post('/users', async (req, res) => {
      const userData = req.body;
      const { useremail } = req.body;
      const query = { useremail: useremail }
      const alreadyhave = await users.find(query).toArray()
      if (alreadyhave.length > 0) {
        return res.send({ mag: 'user allready exist' })
      }
      const result = await users.insertOne(userData)
      res.send(result)
    })
    app.get('/user', async (req, res) => {
      const { useremail } = req.query;
      const query = { useremail: useremail }
      const result = await users.findOne(query)
      res.send(result)
    })
    app.post('/task', verifyToken, async (req, res) => {
      const data = req.body;
      const result = await task.insertOne(data)
      res.send(result)
    })
    app.patch('/task', verifyToken, async (req, res) => {
      const { useremail, id } = req.query;
      if (useremail !== req.user.useremail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const data = req.body;
      const filter = { _id: new ObjectId(id) }
      const query = {
        $set: {
          ...data
        }
      }
      const result = await task.updateOne(filter,query)
      res.send(result)
    })
    app.delete('/task', verifyToken, async (req, res) => {
      const { useremail, id } = req.query;
      if (useremail !== req.user.useremail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
  
      const result = await task.deleteOne({_id : new ObjectId(id)})
      res.send(result)
    })
    app.get('/task', verifyToken, async (req, res) => {
      const { useremail,status } = req.query;
      if (useremail !== req.user.useremail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const currentDate = new Date();
      const query = {
        useremail: useremail,
        status: status,
        deadline: { $gte: currentDate.toISOString().split('T')[0] }
      };
      const result = await task.find(query).sort({ priority: -1 }).toArray()
      res.send(result)
    })
    app.get('/alltask', verifyToken, async (req, res) => {
      const { useremail } = req.query;
      if (useremail !== req.user.useremail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const currentDate = new Date();
      const query = {
        useremail: useremail,
        deadline: { $lt: currentDate.toISOString().split('T')[0] }
      };
      const result = await task.find(query).sort({ deadline: -1 }).toArray()
      res.send(result)
    })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);
app.get('/', async (req, res) => {
  res.send('FrankStore Server is running')
})
app.listen(port, () => {
  console.log(`server is runing on port ${port}`)
})