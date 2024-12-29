import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import userchats from "./models/userChat.js";
import Chat from "./models/chat.js";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

const port = process.env.PORT || 3000;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(express.json());

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
  }
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IK_ENDPOINT,
  publicKey: process.env.IK_PUBLIC_KEY,
  privateKey: process.env.IK_SECRET_KEY,
});

// ImageKit authentication endpoint
app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// Create a new chat
app.post("/api/chats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;
  try {
    const newChat = new Chat({
      userId,
      history: [{ role: "user", parts: [{ text }] }],
    });
    const savedChat = await newChat.save();

    const userChats = await userchats.find({ userId });
    if (!userChats.length) {
      const newUserChats = new userchats({
        userId,
        chats: [{ _id: savedChat._id, title: text.substring(0, 40) }],
      });
      await newUserChats.save();
    } else {
      await userchats.updateOne(
        { userId },
        {
          $push: {
            chats: { _id: savedChat._id, title: text.substring(0, 40) },
          },
        }
      );
    }
    res.status(201).send(savedChat._id);
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).send("Error creating chat!");
  }
});

// Get user chats
app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  console.log("Authenticated User ID:", req.auth.userId);
  const userId = req.auth.userId;
  try {
    const userChats = await userchats.find({ userId });
    if (!userChats.length) {
      return res.status(404).json({ error: "No chats found for this user!" });
    }
    res.status(200).json(userChats[0].chats);
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ error: "Error fetching user chats!" });
  }
});

// Get a specific chat
app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    res.status(200).send(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).send("Error fetching chat!");
  }
});

// Update a chat with a new conversation
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
        $push: { history: { $each: newItems } },
      }
    );
    res.status(200).send(updatedChat);
  } catch (error) {
    console.error("Error updating chat:", error);
    res.status(500).send("Error updating chat!");
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/", "index.html"));
});

// Connect to the database and start the server
app.listen(port, () => {
  connect();
  console.log(`Server is running on port ${port}`);
});
