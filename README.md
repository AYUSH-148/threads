# 🧵 Relay – A Modern Social Media Platform

A full-stack **social networking application**: users create threads, tag each
other, form organizations, and engage through likes, comments and shares.

Three deployables, all **TypeScript**:

| Service | Stack | Why it exists |
| :--- | :--- | :--- |
| **Web** (`src/`) | Next.js 14 App Router, React, Tailwind | Pages, and the mutations that belong next to them |
| **API** (`server/`) | **Node.js + Express** | The work a serverless function cannot do: hold a connection open |
| **Worker** (`worker/`) | **Node.js**, long-running loops | The work a serverless function cannot do: stay alive |

The two Node services are not a second copy of the app. They own the parts of it
that need a process rather than a request — and the reasoning for each boundary is
in [Why three services](#-why-three-services).

---

## 🧩 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Language** | TypeScript end to end — app, API, worker, tests |
| **API service** | Node.js, **Express 5**, Zod request validation, `cors`, `express-rate-limit` |
| **Auth** | Clerk — session middleware in Next, **networkless JWT verification** (`@clerk/backend`) in Express |
| **Real-time** | Server-Sent Events over Redis Pub/Sub |
| **Events** | Redis Streams (consumer groups), transactional outbox |
| **Worker** | Long-running Node process, `p-limit` for bounded concurrency |
| **Database** | MongoDB (Mongoose ODM), multi-document transactions |
| **Frontend** | Next.js 14 App Router, React, TailwindCSS, Shadcn UI |
| **Validation** | Zod (shared by the API's request schemas and the app's forms), React Hook Form |
| **Testing** | Vitest + Supertest — 79 tests, no live infrastructure needed |
| **Observability** | Request-id correlation, structured JSON logs, `/healthz` `/readyz` `/metrics` |
| **Packaging** | Docker — an image per service, Compose for local dependencies or the whole stack |

---

## 🏗️ Why three services

### The API service exists because SSE and serverless are incompatible

Live notifications arrive over Server-Sent Events. That endpoint used to be a
Next.js route handler on Vercel, and it could not work there — its own comments
admitted as much:

> *"Serverless platforms cap function duration, so this connection will be cut
> whatever we do."*

Every cut meant a reconnect, a new Redis subscriber connection, and another
unread-count query — forever, for every open tab. A stream that is meant to stay
open needs a process that stays open. So `server/` is an Express service, deployed
beside the worker, and the endpoint simply works.

Once that process existed, three more things belonged in it:

* **The notification endpoints.** These were Server Actions called from client
  components. A Server Action reachable from the browser is an unversioned RPC
  endpoint with no request validation, no rate limit and no status codes — making
  it an HTTP API is what lets middleware exist at all.
* **Authentication that works outside Next.** `auth()` from `@clerk/nextjs` reads
  `next/headers` and throws anywhere else, so the API verifies Clerk's JWT itself.
  With `CLERK_JWT_KEY` set that is fully networkless: no outbound call per
  request, and authentication survives a Clerk outage.
* **Observability.** The pipeline previously had none. Relay lag, stream depth,
  unacknowledged entries and dead-letter count were answerable only from a Redis
  shell.

### The worker exists because a consumer group needs a heartbeat

A serverless function cannot hold `XREADGROUP` open, and there is nowhere for a
500ms poll loop to live. See [Notification pipeline](#-notification-pipeline).

### They are separate from each other because they scale on different axes

The API's load is the number of *connected viewers*; the worker's is the number of
*events*. Merged, absorbing a traffic spike would mean adding event consumers, and
absorbing a notification spike would mean adding SSE capacity.

### What stayed in Next

Thread, user and community mutations are still Server Actions, and the activity
feed is still server-rendered. Moving them behind HTTP would add a network hop and
a second failure mode to reach the same database, in exchange for nothing.

The line is drawn at *who calls it*: a browser calls the API, a Server Component
calls the query module directly. Both go through the same code in
`src/lib/notifications/` — they share the query, not the transport.

---

## 🌐 API

Base URL is `NEXT_PUBLIC_API_URL`. Every `/api/*` endpoint requires a Clerk
session token; the health endpoints require nothing.

| Method | Path | Notes |
| :--- | :--- | :--- |
| `GET` | `/api/notifications?page=&pageSize=` | Paginated feed. Zod-validated, `pageSize` capped at 50 |
| `GET` | `/api/notifications/unread-count` | The badge. The cheapest endpoint here by design |
| `POST` | `/api/notifications/read` | Clears the badge. Takes **no body** — see below |
| `GET` | `/api/stream` | SSE. Authenticates via `?token=` |
| `GET` | `/healthz` | Liveness. Touches no dependency |
| `GET` | `/readyz` | Readiness. 503 when Mongo or Redis is unreachable |
| `GET` | `/metrics` | Outbox lag, stream depth, DLQ size, open SSE connections |

Errors are uniform, and carry the correlation id echoed in `X-Request-Id`:

```json
{ "error": { "code": "invalid_request", "message": "Request validation failed",
             "requestId": "4c5535a3-…", "details": [ { "path": "page", "message": "…" } ] } }
```

### Decisions worth explaining

**No endpoint takes a user id.** Identity comes from the token's signature and
nowhere else. `POST /read` has no body at all, so there is no `userId` parameter to
forge — and a test asserts that a body trying to supply one is ignored.

**Bearer tokens, not cookies.** A browser will not attach an `Authorization`
header to a cross-site request on its own, so the API has no CSRF surface to
defend and CORS does not need to allow credentials.

**Except on SSE, where the token is in the query string.** `EventSource` cannot set
request headers. There is no version of this endpoint that authenticates over a
header without giving up the browser's built-in streaming client. Two things make
it acceptable, and both are tested: the value is redacted from the access log, and
a Clerk session token expires in about a minute.

**Which also means the client reconnects by hand.** `EventSource`'s built-in
reconnect replays the original URL — including the now-expired token — so it would
spend the rest of the session collecting 401s. `NotificationBell` reconnects with a
fresh token, backing off exponentially *with jitter*: the server closes every
stream at once when it shuts down, and a fixed delay would bring all of them back
in the same instant.

**Liveness checks nothing.** A liveness probe that checked MongoDB would make the
platform restart every replica during a database blip — removing the only processes
still able to serve anything, and turning a degraded system into an outage.
Dependency checks belong in readiness, where a 503 removes an instance from the
load balancer without killing it.

**Two rate limits.** A coarse one before authentication, keyed by IP, because a
401 still costs a signature verification. A fine one after, keyed by user, so one
account cannot spend another's budget by sharing a NAT with it.

---

## 🚀 Features

* 🧑‍🤝‍🧑 **Thread-based interaction** – Create, comment, like, share, and tag users in posts.
* 🏢 **Organization & community support** – Form or join organizations and collaborate on public or private threads.
* 🔒 **Secure authentication** – Clerk sessions in the app, verified JWTs at the API.
* 📸 **Media uploads** – UploadThing.
* 🔔 **Live notifications** – Likes, replies and community posts arrive as they happen over SSE, with unread state, collapsing ("Alice and 3 others") and pagination.
* ⚡ **Organization sync** – Clerk webhooks keep organizations and memberships in step with the database.
* 🎨 **Elegant UI** – TailwindCSS and Shadcn UI, responsive and accessible.
* 📈 **Operable** – Correlated structured logs, readiness probes, and pipeline lag metrics.

---

## 🔔 Notification pipeline

The activity feed used to be derived on every read: it loaded every thread the
viewer had ever authored, flattened every embedded like into memory, and merged
the result. The work done per page view grew with the account's whole history, and
the shape could express neither read state nor pagination.

It is now materialised at write time by an event pipeline.

```
Server Action ──1──▶ MongoDB  ┌ threads: $push like ┐ one transaction
   (Vercel)                   └ outbox: insert(event) ┘
                                   │
                                   2 relay polls unpublished (500ms)
                                   ▼
                            Redis Stream ──3──▶ consumer group
                                   ▲                  │      worker/
                                   4 XACK             5 bulkWrite (p-limit 20)
                                                      ▼
                                              MongoDB notifications
                                                      │
                                                      6 PUBLISH user:{id}
                                                      ▼
                                       Redis Pub/Sub ──▶ Express SSE ──▶ browser
                                                              server/
```

**Why an outbox.** Publishing to Redis after the domain write would silently lose
the notification whenever the process died in between — and leave no trace that it
had. Writing the event into MongoDB in the same transaction as the like makes it
durable before anything tries to move it. Redis carries events; it never owns them.

**Why the writes are idempotent.** Redis Streams delivers at-least-once, and
`XAUTOCLAIM` redelivers anything a crashed worker never acknowledged, so every
event is eventually processed more than once. Notifications collapse into one row
per `(recipient, kind, thread)` and the actor list is rebuilt with
`$filter`-then-append rather than incremented with `$inc`, which would
double-count. At-least-once delivery plus idempotent writes is effectively-once.

**Why Redis Streams and not Kafka.** The outbox already makes MongoDB the durable
record, so the broker only has to be reliable transport. What Kafka would add —
cheap multi-day retention and many independent consumer groups — is not needed at
this scale, and Redis was already in the stack for the SSE fan-out. The migration
trigger is retention economics: Redis retention costs RAM, Kafka's costs disk. The
producer and consumer sit behind an `EventBus` interface
(`src/lib/events/bus.ts`) so that switch is an adapter, not a rewrite.

**Why SSE and not WebSockets.** The traffic is one-directional, `EventSource`
reconnects, and horizontal scaling is handled by Redis Pub/Sub rather than by
pinning a user to a server. Messages carry no payload — they say "something
changed" and the client asks for the count, so one post in a large community does
not mean one `countDocuments` per member.

### Watching it

```bash
curl localhost:4000/metrics
```

```json
{ "outbox": { "unpublished": 0, "oldestUnpublishedAgeMs": null },
  "stream": { "length": 6, "pending": 0, "deadLettered": 0 },
  "sse":    { "connections": 0 } }
```

`oldestUnpublishedAgeMs` is the number that matters. A high backlog during a burst
is normal; the oldest row ageing past a couple of seconds means the relay is wedged
and events are sitting in MongoDB going nowhere. A non-zero `deadLettered` means
events were discarded and should alert.

### Verifying it

```bash
npm run verify:pipeline
```

Steps the pipeline one cycle at a time and asserts three claims: atomic emit,
redelivery changing nothing, and read state surviving redelivery but yielding to
genuinely new activity. Fixtures are prefixed `__verify_` and removed afterwards —
point it at a development database.

---

## 🧪 Tests

```bash
npm test
```

79 tests, no MongoDB, no Redis, no Clerk, no listening socket except where the
subject *is* the socket.

That is possible because the HTTP layer depends on four interfaces in
`server/ports.ts` rather than on Mongoose and Redis directly — the same reasoning
as `EventBus` in the pipeline. `createApp()` takes them as arguments and never
calls `listen()`, so tests drive the real middleware chain, in production order,
against fakes.

What is covered:

* **Auth** — missing, malformed, forged and wrong-scheme credentials; that a query
  token cannot rescue a broken header; that a rejected request never reaches the
  database.
* **Validation** — every rejected paging input, and that defaults are applied.
* **Authorization** — that a body-supplied `userId` is ignored in favour of the
  token's.
* **Errors** — uniform shape, correlation id present, that a 500 does not leak an
  internal message (asserted against a connection string) in production, and that
  a malformed JSON body is the client's 400 rather than this service's 500.
* **Rate limiting** — that the ceiling is enforced, and that a 429 arrives in the
  same envelope as every other error rather than the limiter's own.
* **SSE** — that the subscription is live *before* the client is told the stream is
  open, that a published message becomes a data frame, that a disconnect releases
  the Redis connection, and that shutdown ends every stream.
* **Log redaction** — that the SSE token never reaches a log line.
* **The `$lookup` ordering trap** — `mapNotificationRow` restores actor recency
  from the requested id order, because `$lookup` does not preserve it and getting
  it wrong renders a plausible, permanently wrong "Ada and 2 others".

---

## 🏁 Getting Started

### 1️⃣ Clone and install

```bash
git clone https://github.com/AYUSH-148/Relay.git
cd Relay
npm install
```

### 2️⃣ Configure environment

```bash
cp .env.example .env
```

Worth calling out:

* `MONGODB_URL` **must point at a replica set** — the outbox write and the domain
  write happen in one transaction, which a standalone `mongod` cannot do. Atlas,
  including the free M0 tier, already is one.
* `REDIS_URL` — [Upstash](https://upstash.com) has a free tier, or use the local
  service in `docker-compose.yml`.
* `NEXT_PUBLIC_API_URL` — where the browser finds the API service.
  `http://localhost:4000` locally.
* `APP_ORIGIN` — which origins the API accepts, and which `authorizedParties` the
  Clerk token must have been issued for.
* `CLERK_JWT_KEY` — optional but recommended. Makes token verification networkless.

```bash
npm run db:indexes   # build the indexes declared in src/lib/models/
```

### 3️⃣ Run

Three processes:

```bash
npm run dev:all
```

Or separately, if you want the logs apart:

```bash
npm run dev         # terminal 1 — Next.js      :3000
npm run api:dev     # terminal 2 — Express API  :4000
npm run worker:dev  # terminal 3 — relay + consumer
```

What breaks without each: no API means no live badge and no activity reads. No
worker means likes and replies still succeed, they just never become
notifications.

### 4️⃣ Deploy

| Component | Host | Notes |
| :--- | :--- | :--- |
| Next.js app | Vercel | Set `NEXT_PUBLIC_API_URL` to the API's public URL. Or containerise it — see [Docker](#-docker) |
| API service | Railway / Fly / Render | Long-running. `npm run api`, or build `server/Dockerfile`. Point readiness at `/readyz` |
| Worker | Railway / Fly / Render | Long-running. `npm run worker`, or `worker/Dockerfile` |
| MongoDB | Atlas | Replica set required |
| Redis | Upstash | Streams, Pub/Sub and the relay lock share one instance |

The API and worker must be somewhere that keeps a process alive and forwards
`SIGTERM` — both drain on it, and the API's drain is what closes open SSE streams
so a deploy does not hang waiting for responses that never end.

---

## 🐳 Docker

One image per service:

| Image | Dockerfile | Shape |
| :--- | :--- | :--- |
| Web | [`Dockerfile`](Dockerfile) | Three stages — deps, build, runtime — on Next's `standalone` output |
| API | [`server/Dockerfile`](server/Dockerfile) | Single stage; runs TypeScript through `tsx` |
| Worker | [`worker/Dockerfile`](worker/Dockerfile) | Single stage; runs TypeScript through `tsx` |

All three build from the repo root, so the API and worker import the Mongoose
models, the notification queries and the Redis key names straight out of `src/` —
one definition shared by three services rather than three that drift.

```bash
# Dependencies only (the default). MongoDB + Redis; Node processes on the host.
docker compose up -d

# Everything, containerised.
docker compose --profile app up --build
```

The `app` profile keeps `docker compose up -d` meaning what it always meant. With
the profile, all three services are built and run, reading their configuration
from `.env`.

### Things worth knowing before you build

**`NEXT_PUBLIC_*` are build arguments, not environment variables.** They are
substituted into the client bundle at build time — `NEXT_PUBLIC_API_URL` appears
verbatim in two compiled chunks — so a container started with a different value
silently ignores it. The image must be rebuilt to change them.

**No secrets in the web image.** `docker history` shows every `ARG`, so nothing
secret is passed that way. The build does not need any: it completes with
`CLERK_SECRET_KEY`, `MONGODB_URL` and `REDIS_URL` all unset, because every page
that touches them is server-rendered on demand rather than prerendered. Secrets
reach all three services as runtime environment variables only.

**`public/` is not part of the standalone trace.** Next bundles the server and the
modules it traced; it knows nothing about static assets. `public/` and
`.next/static` are copied separately in the runtime stage, and `.dockerignore`
deliberately does *not* exclude `public` for that reason.

**The app services point at `.env`, not at the `mongo` service.** A replica set is
not transparently reachable across the container boundary: the healthcheck
initiates the set as `localhost:27017`, and a driver connecting from another
container discovers that address and then tries its own loopback. Using the local
Mongo from a container means re-initiating the set as `mongo:27017`, which breaks
host access on `localhost` in exchange. Pointing at Atlas avoids the trade
entirely, and Atlas is what production uses.

**`HOSTNAME=0.0.0.0` in the web image.** Next binds localhost by default, which
inside a container means the published port accepts connections and then hangs.

Docker remains optional throughout — Compose is a convenience, and the Dockerfiles
are one way to package the services rather than a requirement for running them.
