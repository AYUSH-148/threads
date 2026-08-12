import { z } from "zod";

/**
 * Environment contract for the API service.
 *
 * Validated once at boot and never read from `process.env` again below this
 * file. A service that reads env vars lazily inside handlers discovers a missing
 * one as a 500 in front of a user, hours after deploy; this one refuses to start.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),

  MONGODB_URL: z.string().min(1, "required — the API reads the notification collection"),
  REDIS_URL: z.string().min(1, "required — the SSE fan-out subscribes to Redis pub/sub"),

  /** Verifies Clerk session tokens. The same secret the Next app already uses. */
  CLERK_SECRET_KEY: z.string().min(1, "required — the API verifies Clerk session tokens"),

  /**
   * Clerk's PEM public key, optional.
   *
   * Supplying it makes verification fully networkless. Without it the first
   * request fetches Clerk's JWKS and caches it, which is fine but means the
   * service cannot authenticate anyone while Clerk's API is unreachable.
   */
  CLERK_JWT_KEY: z.string().min(1).optional(),

  /** Comma-separated. The browser calls this service cross-origin, so CORS is not optional. */
  APP_ORIGIN: z.string().default("http://localhost:3000"),
});

/**
 * A plain dictionary rather than `NodeJS.ProcessEnv`.
 *
 * Next augments `ProcessEnv` to make `NODE_ENV` a required, narrowly-typed
 * property, which makes every partial literal — including the ones the tests
 * build — unassignable. `process.env` satisfies this type, so nothing is lost.
 */
export type EnvSource = Record<string, string | undefined>;

export interface ApiConfig {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  mongodbUrl: string;
  redisUrl: string;
  clerkSecretKey: string;
  clerkJwtKey?: string;
  allowedOrigins: string[];
}

/**
 * Reads and validates the environment.
 *
 * Throws with every problem at once rather than the first — restarting a
 * container five times to be told about five missing variables one at a time is
 * a waste of everyone's afternoon.
 */
export function loadConfig(env: EnvSource = process.env): ApiConfig {
  const parsed = EnvSchema.safeParse(withoutBlanks(env));

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid API environment:\n${problems}\n\nSee .env.example.`);
  }

  const value = parsed.data;

  return {
    nodeEnv: value.NODE_ENV,
    isProduction: value.NODE_ENV === "production",
    port: value.PORT,
    mongodbUrl: value.MONGODB_URL,
    redisUrl: value.REDIS_URL,
    clerkSecretKey: value.CLERK_SECRET_KEY,
    clerkJwtKey: value.CLERK_JWT_KEY,
    allowedOrigins: value.APP_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

/**
 * Treats an empty value as an absent one.
 *
 * `.env` files declare optional settings as a bare `KEY=`, which arrives as an
 * empty string rather than as undefined — so `.optional()` alone does not cover
 * it, and `CLERK_JWT_KEY=` in a copied .env.example would refuse to boot the
 * service over a variable that is not required. Docker Compose produces the same
 * shape when it interpolates an unset variable.
 *
 * Required variables are unaffected: dropping a blank leaves the key missing,
 * which is still an error, and still names the variable in the message.
 */
function withoutBlanks(env: EnvSource): EnvSource {
  const cleaned: EnvSource = {};

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.trim() === "") continue;
    cleaned[key] = value;
  }

  return cleaned;
}
