import mongoose from "mongoose";
const userChatSchema = new mongoose.Schema({
    userId:{
        type:String,
        required:true,
         
    },
    chats:[
        {
            _id:{
                type:String,
                required:true,
            },
            title:{
                type:String,
                required:true,
            },
            crreatedAt:{
                type:Date,
                default: Date.now(),
            },
           
           
        }
    ]
},{timestamps:true})

export default mongoose.models.userchats || mongoose.model("userchats",userChatSchema)