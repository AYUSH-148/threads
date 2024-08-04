/* eslint-disable camelcase */
// Resource: https://clerk.com/docs/users/sync-data-to-your-backend
// Above article shows why we need webhooks i.e., to sync data to our backend

// Resource: https://docs.svix.com/receiving/verifying-payloads/why
// It's a good practice to verify webhooks. Above article shows why we should do it
import { Webhook, WebhookRequiredHeaders } from "svix";
import { headers } from "next/headers";

import { IncomingHttpHeaders } from "http";

import { NextResponse } from "next/server";
import {
  addMemberToCommunity,
  createCommunity,
  deleteCommunity,
  removeUserFromCommunity,
  updateCommunityInfo,
} from "@/lib/actions/community.actions";

// Resource: https://clerk.com/docs/integration/webhooks#supported-events
// Above document lists the supported events
type EventType =
  | "organization.created"
  | "organizationInvitation.created"
  | "organizationMembership.created"
  | "organizationMembership.deleted"
  | "organization.updated"
  | "organization.deleted";

type Event = {
  data: {
    id: string;
    name?: string;
    slug?: string;
    logo_url?: string;
    image_url?: string;
    created_by?: string;
    organization?: {
      id: string;
    };
    public_user_data?: {
      user_id: string;
    };
  };
  object: "event";
  type: EventType;
};

export const POST = async (request: Request) => {
  const payload = await request.json();
  const header = headers();

  const heads = {
    "svix-id": header.get("svix-id") as string,
    "svix-timestamp": header.get("svix-timestamp") as string,
    "svix-signature": header.get("svix-signature") as string,
  };

  // Activate Webhook in the Clerk Dashboard.
  // After adding the endpoint, you'll see the secret on the right side.
  const wh = new Webhook(process.env.NEXT_CLERK_WEBHOOK_SECRET || "");

  let evnt: Event | null = null;

  try {
    evnt = wh.verify(
      JSON.stringify(payload),
      heads as IncomingHttpHeaders & WebhookRequiredHeaders
    ) as Event;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ message: "Webhook verification failed" }, { status: 400 });
  }

  const eventType: EventType = evnt?.type!;

  try {
    switch (eventType) {
      case "organization.created":
        {
          const { id, name, slug, logo_url, image_url, created_by } = evnt.data;
        //@ts-ignore
          await createCommunity(id, name, slug, logo_url || image_url, "org bio", created_by);
        }
        break;

      case "organizationInvitation.created":
        {
          // Handle organization invitation created event
        }
        break;

      case "organizationMembership.created":
        {
          const { organization, public_user_data } = evnt.data;
          if (organization && public_user_data) {
            await addMemberToCommunity(organization.id, public_user_data.user_id);
          }
        }
        break;

      case "organizationMembership.deleted":
        {
          const { organization, public_user_data } = evnt.data;
          if (organization && public_user_data) {
            await removeUserFromCommunity(public_user_data.user_id, organization.id);
          }
        }
        break;

      case "organization.updated":
        {
          const { id, logo_url, name, slug } = evnt.data;
          //@ts-ignore
          await updateCommunityInfo(id, name, slug, logo_url);
        }
        break;

      case "organization.deleted":
        {
          const { id } = evnt.data;
          await deleteCommunity(id);
        }
        break;

      default:
        console.warn(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ message: "Event processed successfully" }, { status: 201 });
  } catch (err) {
    console.error("Error processing event:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
};
