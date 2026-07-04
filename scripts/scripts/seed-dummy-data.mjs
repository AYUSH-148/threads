import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URL || 'mongodb+srv://ayushpro111:547579@cluster0.qxpdxrf.mongodb.net/?appName=Cluster0';
const dbName = process.env.MONGODB_DB || 'threads';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  image: String,
  bio: String,
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  onboarded: { type: Boolean, required: true },
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community' }],
});

const communitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  image: String,
  bio: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const threadSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
  tags: [{ type: String }],
  likes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    threadId: { type: String },
    date: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  parentId: String,
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Community = mongoose.models.Community || mongoose.model('Community', communitySchema);
const Thread = mongoose.models.Thread || mongoose.model('Thread', threadSchema);

const seedCommunities = [
  {
    id: 'tech-hub',
    username: 'techhub',
    name: 'Tech Hub',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    bio: 'A lively space for product builders, AI enthusiasts, and startup founders.',
  },
  {
    id: 'design-lab',
    username: 'designlab',
    name: 'Design Lab',
    image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
    bio: 'Sharing thoughtful UI ideas, design systems, and visual inspiration.',
  },
  {
    id: 'devops-daily',
    username: 'devopsdaily',
    name: 'DevOps Daily',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80',
    bio: 'Practical conversations around deployment, reliability, and automation.',
  },
];

const seedThreads = [
  {
    text: 'What are the best habits for shipping features without burning out the team?',
    tags: ['productivity', 'teamwork', 'startups'],
    likes: 1,
    communityId: 'tech-hub',
  },
  {
    text: 'I keep seeing great design systems that feel too rigid. How do you balance consistency and creativity?',
    tags: ['design', 'ux', 'systems'],
    likes: 2,
    communityId: 'design-lab',
  },
  {
    text: 'What monitoring setup would you recommend for a small SaaS product?',
    tags: ['monitoring', 'saas', 'observability'],
    likes: 1,
    communityId: 'devops-daily',
  },
  {
    text: 'A quick follow-up on deployment pipelines: when do you move from GitHub Actions to a more advanced orchestration tool?',
    tags: ['devops', 'ci-cd', 'automation'],
    likes: 3,
    communityId: 'devops-daily',
  },
];

async function main() {
  await mongoose.connect(mongoUri, { dbName });

  const authorIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];

  const communityDocs = [];
  for (const community of seedCommunities) {
    const existingCommunity = await Community.findOne({ id: community.id });
    if (existingCommunity) {
      await Community.findByIdAndDelete(existingCommunity._id);
      await Thread.deleteMany({ community: existingCommunity._id });
    }
  }

  for (const [index, community] of seedCommunities.entries()) {
    const createdCommunity = await Community.create({
      ...community,
      createdBy: authorIds[index % authorIds.length],
      members: authorIds.slice(0, 2),
    });
    communityDocs.push(createdCommunity);
  }

  for (const [index, thread] of seedThreads.entries()) {
    const community = communityDocs.find((item) => item.id === thread.communityId);
    if (!community) continue;

    const createdThread = await Thread.create({
      text: thread.text,
      author: authorIds[index % authorIds.length],
      community: community._id,
      tags: thread.tags,
      likes: Array.from({ length: thread.likes }, (_, i) => ({
        userId: authorIds[(index + i) % authorIds.length],
        threadId: new mongoose.Types.ObjectId().toString(),
      })),
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 6),
    });

    await Community.findByIdAndUpdate(community._id, {
      $push: { threads: createdThread._id },
    });

    if (thread.communityId === 'devops-daily' && index === 3) {
      const parentThread = await Thread.findOne({ text: seedThreads[2].text });
      if (parentThread) {
        const reply = await Thread.create({
          text: 'I usually start with a simple GitHub Actions setup and only scale once the workflow becomes painful.',
          author: authorIds[(index + 1) % authorIds.length],
          community: community._id,
          tags: ['devops', 'reply'],
          parentId: parentThread._id.toString(),
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        });
        await Thread.findByIdAndUpdate(parentThread._id, { $push: { children: reply._id } });
      }
    }
  }

  const communityCount = await Community.countDocuments();
  const threadCount = await Thread.countDocuments();
  console.log(`Seeded ${communityCount} communities and ${threadCount} threads successfully.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
