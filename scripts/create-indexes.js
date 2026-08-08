/**
 * Builds the indexes declared in src/lib/models/*.ts against the configured
 * MongoDB.
 *
 *   npm run db:indexes
 *
 * Idempotent and non-destructive: createIndex() is a no-op for an index that
 * already exists, and nothing is ever dropped. (Deliberately not syncIndexes(),
 * which would drop any index missing from the schemas.)
 *
 * Mongoose autoIndex would build these on first connect, but that is implicit,
 * runs on a request's critical path, and is usually disabled in production —
 * so indexes are created explicitly here instead.
 */
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

// Keep in sync with the schema.index(...) declarations in src/lib/models/.
const INDEXES = {
  threads: [
    [{ parentId: 1, createdAt: -1 }, {}],
    [{ author: 1 }, {}],
    [{ tags: 1 }, {}],
  ],
  users: [
    [{ id: 1 }, { unique: true }],
    [{ communities: 1 }, {}],
  ],
  communities: [
    [{ id: 1 }, { unique: true }],
    [{ members: 1 }, {}],
  ],
};

/**
 * A unique index build fails outright if the existing data already violates it.
 * Check first so the failure names the offending values instead of surfacing an
 * opaque driver error.
 */
async function assertNoDuplicates(db, collection, field) {
  const duplicates = await db
    .collection(collection)
    .aggregate([
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicates.length > 0) {
    throw new Error(
      `Cannot build a unique index on ${collection}.${field} — duplicate values: ` +
        duplicates.map((d) => `${d._id} (x${d.count})`).join(', ')
    );
  }
}

async function main() {
  if (!process.env.MONGODB_URL) {
    throw new Error('Missing MONGODB_URL in .env');
  }

  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;

  await assertNoDuplicates(db, 'users', 'id');
  await assertNoDuplicates(db, 'communities', 'id');

  for (const [collection, specs] of Object.entries(INDEXES)) {
    console.log(`\n${collection}`);
    const existing = (await db.collection(collection).indexes()).map((i) =>
      JSON.stringify(i.key)
    );

    for (const [key, options] of specs) {
      const name = await db.collection(collection).createIndex(key, options);
      const alreadyThere = existing.includes(JSON.stringify(key));
      console.log(
        `  ${alreadyThere ? 'exists ' : 'created'}  ${JSON.stringify(key)}  -> ${name}`
      );
    }
  }

  console.log('\nFinal index state:');
  for (const collection of Object.keys(INDEXES)) {
    const indexes = await db.collection(collection).indexes();
    console.log(`  ${collection}: ${indexes.map((i) => i.name).join(', ')}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
