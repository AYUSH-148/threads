import { getSubscriber } from "../../src/lib/redis";
import type { SubscriberPort, Unsubscribe } from "../ports";

/**
 * One Redis connection per open stream.
 *
 * Not a shared one: a connection that has issued SUBSCRIBE rejects every
 * ordinary command, so reusing the service's command connection would break
 * every other query the moment one browser opened the stream.
 *
 * The cost is real — a connection per connected viewer — and it is the reason
 * `close` in the stream route is not optional. An instance that leaks these runs
 * out of Redis connections long before it runs out of anything else.
 */
export function createRedisSubscriber(): SubscriberPort {
  return {
    async subscribe(channel, onMessage): Promise<Unsubscribe> {
      const client = await getSubscriber();

      try {
        await client.subscribe(channel, onMessage);
      } catch (err) {
        // Do not strand the connection if SUBSCRIBE itself fails; the caller is
        // about to receive an exception and will never get an unsubscribe back.
        await client.quit().catch(() => {});
        throw err;
      }

      return async () => {
        // Unsubscribe first: quitting while a subscription is live races the
        // teardown and can leave the server-side registration behind.
        await client.unsubscribe(channel).catch(() => {});
        await client.quit().catch(() => {});
      };
    },
  };
}
