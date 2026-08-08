import mongoose from "mongoose"

const communitySchema = new mongoose.Schema({
    id: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: String,
    bio: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    threads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Thread",
      },
    ],
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  }, { timestamps: true }); // fetchCommunities() sorts on createdAt, which didn't exist before

  // The Clerk organization id. Looked up on every createThread() call and by
  // all six organization webhook handlers.
  communitySchema.index({ id: 1 }, { unique: true });

  // fetchFriends() -> Community.find({ members })
  communitySchema.index({ members: 1 });

  const Community = mongoose.models.Community || mongoose.model("Community", communitySchema);
  
  export default Community;
  
