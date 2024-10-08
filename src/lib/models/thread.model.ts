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
const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);

export default Thread;