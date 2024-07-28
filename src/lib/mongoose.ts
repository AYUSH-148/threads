import mongoose from "mongoose"

let isConnected = false;

export const connectToDb = async()=>{
    mongoose.set("strictQuery",true);
    if(!process.env.MONGODB_URL){
        console.log("Missing MongoDb URL");
        return 
    }
    if (isConnected) {
        console.log("MongoDB connection already established");
        return;
    }
    try{
        await mongoose.connect(process.env.MONGODB_URL);
        isConnected= true;
        console.log("MongoDb connected");
    }catch(error){
        console.log(error);
    }
}