# 🧵 Threads – A Modern Social Media Platform

A full-stack **social networking application** built with **Next.js 14**, enabling users to create threads, tag other users, form organizations, and engage through likes, comments, and shares — all with a **modern UI and secure authentication**.

---

## 💡 System Architecture Overview

This application follows a modern, server-side-centric architecture leveraging the **Next.js 14 App Router** and **Server Actions**.

* **Frontend (UI):** Built with React components, styled with **Tailwind CSS** and **Shadcn UI**.
* **Backend Logic:** Handled primarily by **Next.js Server Actions** (for mutation/API logic) and **REST APIs** for specific needs, ensuring fast data fetching and mutations.
* **Database:** **MongoDB** is used for flexible, NoSQL data storage, accessed via the **Mongoose ORM**.
* **Authentication:** **Clerk** manages all user authentication (sign-in, sign-up, sessions) and identity, while **Clerk webhooks** enable real-time synchronization between Clerk's user data and the MongoDB application database.
* **File Storage:** **UploadThing** provides secure and reliable file (media) uploads.
* **Events:** Likes, replies and community posts are written to a **transactional outbox** and relayed onto **Redis Streams**, where a worker materialises notifications and pushes them to the browser over **SSE**. See [Notification pipeline](#-notification-pipeline).

---

## 🚀 Features

* 🧑‍🤝‍🧑 **Thread-based interaction** – Create, comment, like, share, and tag users in posts.
* 🏢 **Organization & community support** – Form or join organizations and collaborate on public or private threads.
* 🔒 **Secure authentication** – Powered by **Clerk**, supporting sign-in, sign-up, and session management.
* 📸 **Media uploads** – Integrated with **UploadThing** for fast and reliable file uploads.
* 🔔 **Live notifications** – Likes, replies and community posts arrive as they happen over Server-Sent Events, with unread state, collapsing ("Alice and 3 others") and pagination.
* ⚡ **Organization sync** – Clerk webhooks keep organizations and memberships in step with the application database.
* 🎨 **Elegant UI** – Built with **TailwindCSS** and **Shadcn UI**, ensuring responsive and accessible design.
* 🧠 **Data validation & forms** – Using **Zod** and **React Hook Form** for robust validation and form handling.
* 🏗️ **Scalable architecture** – Designed with reusable components and clean folder structures for maintainability.

---

## 🧩 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14, React, TypeScript, TailwindCSS, Shadcn UI |
| **Backend** | Next.js Server Actions, REST APIs |
| **Database** | MongoDB (Mongoose ODM), multi-document transactions |
| **Events** | Redis Streams (consumer groups), transactional outbox |
| **Worker** | Long-running Node process (`tsx`), `p-limit` for bounded concurrency |
| **Real-time** | Server-Sent Events over Redis Pub/Sub |
| **Auth** | Clerk Authentication & Webhooks |
| **File Uploads** | UploadThing |
| **Validation** | Zod, React Hook Form |
| **Version Control** | Git, GitHub |
| **Deployment** | Vercel |

---

## 🔔 Notification pipeline

The activity feed used to be derived on every read: it loaded every thread the
viewer had ever authored, flattened every embedded like into memory, and merged
the result. The work done per page view grew with the account's whole history,
and the shape could express neither read state nor pagination.

It is now materialised at write time by an event pipeline.

```
Server Action ──1──▶ MongoDB  ┌ threads: $push like ┐ one transaction
   (Vercel)               └ outbox: insert(event) ┘
                                   │
                                   2 relay polls unpublished (500ms)
                                   ▼
                            Redis Stream ──3──▶ consumer group
                                   ▲                  │
                                   4 XACK             5 bulkWrite (p-limit 20)
                                                      ▼
                                              MongoDB notifications
                                                      │
                                                      6 PUBLISH user:{id}
                                                      ▼
                                       Redis Pub/Sub ──▶ SSE ──▶ browser
```

**Why an outbox.** Publishing to Redis after the domain write would silently
lose the notification whenever the process died in between — and leave no trace
that it had. Writing the event into MongoDB in the same transaction as the like
makes it durable before anything tries to move it. Redis carries events; it
never owns them.

**Why the writes are idempotent.** Redis Streams delivers at-least-once, and
`XAUTOCLAIM` redelivers anything a crashed worker never acknowledged, so every
event is eventually processed more than once. Notifications collapse into one
row per `(recipient, kind, thread)` and the actor list is rebuilt with
`$filter`-then-append rather than incremented with `$inc`, which would
double-count. At-least-once delivery plus idempotent writes is effectively-once.

**Why Redis Streams and not Kafka.** The outbox already makes MongoDB the
durable record, so the broker only has to be reliable transport. What Kafka
would add — cheap multi-day retention and many independent consumer groups —
is not needed at this scale, and Redis was already in the stack for the SSE
fan-out. The migration trigger is retention economics: Redis retention costs
RAM, Kafka's costs disk. The producer and consumer sit behind an `EventBus`
interface (`src/lib/events/bus.ts`) so that switch is an adapter, not a rewrite.

**Why SSE and not WebSockets.** The traffic is one-directional, `EventSource`
reconnects on its own, and horizontal scaling is handled by Redis Pub/Sub rather
than by pinning a user to a server. Messages carry no payload — they say
"something changed" and the client asks for the count, so one post in a large
community does not mean one `countDocuments` per member.

**Why the worker is a separate process.** A consumer group needs something that
stays alive. Serverless functions cannot hold `XREADGROUP` open, and there is
nowhere for a 500ms poll loop to live.

### Verifying it

```bash
npm run verify:pipeline
```

Steps the pipeline one cycle at a time and asserts the three claims above:
atomic emit, redelivery changing nothing, and read state surviving redelivery
but yielding to genuinely new activity. Fixtures are prefixed `__verify_` and
removed afterwards — point it at a development database.

---

## 🏁 Getting Started

### 1️⃣ Clone and install

```bash
git clone https://github.com/AYUSH-148/threads.git
cd threads
npm install
```

### 2️⃣ Configure environment

```bash
cp .env.example .env
```

Two requirements worth calling out:

* `MONGODB_URL` **must point at a replica set** — the outbox write and the
  domain write happen in one transaction, which a standalone `mongod` cannot do.
  Atlas, including the free M0 tier, already is one.
* `REDIS_URL` — [Upstash](https://upstash.com) has a free tier, or use the local
  service in `docker-compose.yml`.

```bash
npm run db:indexes   # build the indexes declared in src/lib/models/
```

### 3️⃣ Run

The app and the worker are two processes. Notifications are written by the
worker, so without it likes and replies still succeed — they just never turn
into notifications.

```bash
npm run dev        # terminal 1 — Next.js
npm run worker:dev # terminal 2 — relay + consumer
```

### 4️⃣ Deploy

| Component | Host | Notes |
| :--- | :--- | :--- |
| Next.js app | Vercel | Unchanged |
| Worker | Railway / Fly / Render | Long-running process. `npm run worker`, or build `worker/Dockerfile` |
| MongoDB | Atlas | Replica set required |
| Redis | Upstash | Streams, Pub/Sub and the relay lock share one instance |

Docker is optional throughout: `docker-compose.yml` is a local-development
convenience, and `worker/Dockerfile` is one way to package the worker rather
than a requirement for running it.
