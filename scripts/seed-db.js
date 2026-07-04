const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

process.env.MONGODB_URL = process.env.MONGODB_URL || env.MONGODB_URL;

const User = mongoose.model('User', new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  image: String,
  bio: String,
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  onboarded: { type: Boolean, required: true },
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
}));

const Community = mongoose.model('Community', new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  image: String,
  bio: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
  tags: [{ type: String }],
  likes: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, threadId: String, date: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now },
  parentId: String,
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
}));

async function seed() {
  if (!process.env.MONGODB_URL) {
    throw new Error('Missing MONGODB_URL in .env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGODB_URL);

  await Promise.all([
    User.deleteMany({}),
    Community.deleteMany({}),
    Thread.deleteMany({}),
  ]);

  const users = await User.insertMany([
    {
      id: 'user_1',
      username: 'alex.dev',
      name: 'Alex Rivera',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      bio: 'Building apps and sharing ideas.',
      onboarded: true,
    },
    {
      id: 'user_2',
      username: 'maya.codes',
      name: 'Maya Chen',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      bio: 'Loves design systems and product thinking.',
      onboarded: true,
    },
  ]);

  const communities = await Community.insertMany([
    {
      id: 'community_1',
      username: 'nextjsbuilders',
      name: 'Next.js Builders',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
      bio: 'A community for people building with Next.js.',
      createdBy: users[0]._id,
      members: [users[0]._id, users[1]._id],
    },
    {
      id: 'community_2',
      username: 'uiuxclub',
      name: 'UI/UX Club',
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=80',
      bio: 'Discussing interfaces, systems, and user flows.',
      createdBy: users[1]._id,
      members: [users[1]._id, users[0]._id],
    },
  ]);

  const createdThreads = await Thread.insertMany([
    {
      text: 'Welcome to Threads! This is a sample post seeded into your local database.',
      author: users[0]._id,
      community: communities[0]._id,
      tags: ['nextjs', 'mongodb'],
      likes: [],
    },
    {
      text: 'Here is another sample thread for testing the feed and comments.',
      author: users[1]._id,
      community: communities[1]._id,
      tags: ['ui', 'design'],
      likes: [],
    },
    {
      text: 'A quick note on building polished UIs with React and Tailwind.',
      author: users[0]._id,
      community: communities[1]._id,
      tags: ['ui', 'tailwind'],
      likes: [],
    },
    {
      text: 'I am exploring better ways to structure server actions in Next.js.',
      author: users[1]._id,
      community: communities[0]._id,
      tags: ['nextjs', 'server-actions'],
      likes: [],
    },
    {
      text: 'Anyone using MongoDB Atlas with Mongoose for local projects?',
      author: users[0]._id,
      community: communities[0]._id,
      tags: ['mongodb', 'database'],
      likes: [],
    },
    {
      text: 'My favorite part of building a product is refining the onboarding experience.',
      author: users[1]._id,
      community: communities[1]._id,
      tags: ['product', 'ux'],
      likes: [],
    },
    {
      text: 'Sharing a simple component pattern for reusable cards in React.',
      author: users[0]._id,
      community: communities[1]._id,
      tags: ['react', 'components'],
      likes: [],
    },
    {
      text: 'What is your go-to stack for side projects?',
      author: users[1]._id,
      community: communities[0]._id,
      tags: ['discussion', 'stack'],
      likes: [],
    },
    {
      text: 'This is a reply to the first thread.',
      author: users[1]._id,
      parentId: null,
      tags: ['reply'],
      likes: [],
    },
    {
      text: 'Another reply to keep the feed lively.',
      author: users[0]._id,
      parentId: null,
      tags: ['reply'],
      likes: [],
    },
  ]);

  await User.updateMany(
    { _id: { $in: users.map((user) => user._id) } },
    { $push: { threads: { $each: createdThreads.map((thread) => thread._id) } } }
  );

  await Community.updateMany(
    { _id: { $in: communities.map((community) => community._id) } },
    { $push: { threads: { $each: createdThreads.slice(0, 8).map((thread) => thread._id) } } }
  );

  const firstThread = createdThreads[0];
  const secondThread = createdThreads[1];
  const thirdThread = createdThreads[2];

  await Thread.updateMany(
    { _id: { $in: [firstThread._id, secondThread._id, thirdThread._id] } },
    {
      $push: {
        children: [
          createdThreads[8]._id,
          createdThreads[9]._id,
        ],
      },
    }
  );

  await Thread.findByIdAndUpdate(firstThread._id, {
    $push: { likes: { userId: users[1]._id, threadId: firstThread._id.toString(), date: new Date() } },
  });

  await Thread.findByIdAndUpdate(secondThread._id, {
    $push: { likes: { userId: users[0]._id, threadId: secondThread._id.toString(), date: new Date() } },
  });

  await Thread.findByIdAndUpdate(thirdThread._id, {
    $push: { likes: { userId: users[1]._id, threadId: thirdThread._id.toString(), date: new Date() } },
  });

  console.log('Seed completed.');
  console.log({ users: users.length, communities: communities.length, threads: createdThreads.length });
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
