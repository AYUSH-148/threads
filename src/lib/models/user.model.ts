import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    id:{
        type:String, required:true,
    },
    username:{
        type:String,unique:true,required:true
    },
    name:{
        type:String,
        required:true,
    },
    image: String,
    bio:  String,
    threads:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"Thread"
        }
    ],
    onboarded:{
        type:Boolean,
        required: true
    },
    communities:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Community"
        }
    ]
}, { timestamps: true }) // fetchUsers() sorts on createdAt, which didn't exist before

// The Clerk id — the most looked-up field in the app. Read on every page render
// (fetchUser) and on every mutating Server Action (requireCurrentUser).
userSchema.index({ id: 1 }, { unique: true });

// fetchFriends() and deleteCommunity() -> User.find({ communities })
userSchema.index({ communities: 1 });

const User = mongoose.models.User || mongoose.model("User",userSchema)
export default User;