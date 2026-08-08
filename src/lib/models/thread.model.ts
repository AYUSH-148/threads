import mongoose from "mongoose"

const threadSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    community: {
        type: mongoose.Schema.Types.ObjectId, ref: "Community"
    },
    tags: [{ type: String, }],
    likes: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            threadId: {type: String},
            date: { type: Date, default: Date.now },
        },
    ],
    createdAt: {
        type: Date, default: Date.now
    },
    parentId: String,
    children: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Thread"
    }]
})

// Home feed (fetchPosts): filters on parentId and sorts by createdAt. One
// compound index serves both, so MongoDB walks it in order and skips the
// blocking in-memory sort — which is capped at 32MB and errors past it.
// The { parentId: 1 } prefix also serves fetchAllChildThreads().
threadSchema.index({ parentId: 1, createdAt: -1 });

// getActivity() -> Thread.find({ author })
threadSchema.index({ author: 1 });

// Profile "Tagged" tab (fetchtaggedByUsers) -> Thread.find({ tags })
threadSchema.index({ tags: 1 });

const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);

export default Thread;