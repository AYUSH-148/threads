import mongoose from "mongoose"

let isConnected = false;
const dbName = process.env.MONGODB_DB || "threads";
const mongoUri = process.env.MONGODB_URL || "mongodb+srv://ayushpro111:547579@cluster0.qxpdxrf.mongodb.net/?appName=Cluster0";

export const connectToDb = async()=>{
    mongoose.set("strictQuery",true);
    if(!process.env.MONGODB_URL){
        console.log("MongoDb URL not provided, using fallback connection string");
    }
    if (isConnected) {
        console.log("MongoDB connection already established");
        return;
    }
    try{
        await mongoose.connect(mongoUri, {
            dbName,
        });
        isConnected= true;
        console.log(`MongoDb connected to database: ${dbName}`);
    }catch(error){
        console.log(error);
    }
}