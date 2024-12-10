import express from "express"
import cors from "cors"
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import userchats from "./models/userChat.js"
import Chat from "./models/chat.js"
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node'



const port = process.env.PORT || 3000;

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// app.use(cors({
//     origin:process.env.CLIENT_URL,
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     credentials:true,

// }))
// app.use("*", cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use("*",
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json())
const connect = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Mongodb connecte succesfully")
    } catch (error) {
        console.log(err)
        
    }
}
const imagekit = new ImageKit({
    urlEndpoint: process.env.IK_ENDPOINT,
    publicKey: process.env.IK_PUBLIC_KEY,
    privateKey:process.env.IK_SECRET_KEY,
  });

app.get("/api/upload",(req,res)=>{
    const result = imagekit.getAuthenticationParameters();
    res.send(result)
})
app.post("/api/chats",ClerkExpressRequireAuth(),async(req,res)=>{
    const userId= req.auth.userId
   const {text} = req.body;
   try {
    // CREATE a new chats
    const newChat= new Chat({
        userId:userId,
        history:[{role:"user",parts:[{text}]}]
    })
    const savedChat = await newChat.save();
    //CHECK IF USER CHAT EXIST
    const userChats = await userchats.find({userId:userId});
    // if dont exist create a new one add the chat in the chats array
    if(!userChats.length){
        const newUserChats= new userchats({
            userId:userId,
            chats:[
                {
                    _id:savedChat._id,
                    title:
                        text.substring(0,40)
                    
                }
            ]
        })
        await newUserChats.save()
    }else{
        // if exists push the chat to the existing array
        await  userchats.updateOne({
            userId:userId
        },{
            $push:{
                chats:{
                    _id:savedChat._id,
                    title:text.substring(0,40)
                }
            }
        })
        res.status(201).send(newChat._id)
    }
   } catch (error) {
    console.log(error)
    res.status(500).send("Error creating chats!")
   }
});
// app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
//     const userId = req.auth.userId;
  
//     try {
//       const userChats = await userchats.find({ userId });
  
//       res.status(200).send(userChats[0].chats);
//       console.log(userChats)
//     } catch (err) {
//       console.log(err);
//       res.status(500).send("Error fetching userchats!");
//     }
//   });

app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const userChats = await userchats.find({ userId });

    // Handle the case where no chats are found
    if (!userChats || userChats.length === 0) {
      console.log("No chats found for user:", userId);
      return res.status(404).json({ error: "No chats found for this user!" });
    }

    // Validate the structure of the first item in the array
    if (!userChats[0].chats) {
      console.log("Chats property is missing in the database record:", userChats[0]);
      return res.status(500).json({ error: "Chats data is missing!" });
    }

    res.status(200).json(userChats[0].chats);
  } catch (err) {
    console.error("Error fetching userchats:", err);
    res.status(500).json({ error: "Error fetching userchats!" });
  }
});

  app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
    const userId = req.auth.userId;
  
    try {
      const chat = await Chat.findOne({ _id: req.params.id, userId });
  
      res.status(200).send(chat);
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching chat!");
    }
  });

  app.put("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
    const userId = req.auth.userId;
  
    const { question, answer, img } = req.body;
  
    const newItems = [
      ...(question
        ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
        : []),
      { role: "model", parts: [{ text: answer }] },
    ];
  
    try {
      const updatedChat = await Chat.updateOne(
        { _id: req.params.id, userId },
        {
          $push: {
            history: {
              $each: newItems,
            },
          },
        }
      );
      res.status(200).send(updatedChat);
    } catch (err) {
      console.log(err);
      res.status(500).send("Error adding conversation!");
    }
  });

app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(401).send('Unauthenticated!')
  })

  app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/", "index.html"));
});
  

app.listen(port,()=>{
    connect()
    console.log("Server is running on 3000")
})