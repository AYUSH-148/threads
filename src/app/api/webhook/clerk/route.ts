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

type EventType =
  | "organization.created"
  | "organizationInvitation.created"
  | "organizationMembership.created"
  | "organizationMembership.deleted"
  | "organization.updated"
  | "organization.deleted";

type Event = {
  data: Record<string, any>;
  object: "event";
  type: EventType;
};

export const POST = async (request: Request) => {
  const payload = await request.json();
  const header = headers();

  const heads = {
    "svix-id": header.get("svix-id") || "",
    "svix-timestamp": header.get("svix-timestamp") || "",
    "svix-signature": header.get("svix-signature") || "",
  };

  const wh = new Webhook(process.env.NEXT_CLERK_WEBHOOK_SECRET || "");

  let evnt: Event | null = null;

  try {
    evnt = wh.verify(
      JSON.stringify(payload),
      heads as IncomingHttpHeaders & WebhookRequiredHeaders
    ) as Event;
  } catch (err:any) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ message: err.message }, { status: 400 });
  }

  const eventType: EventType = evnt.type;

  try {
    if (eventType === "organization.created") {
      const { id, name, slug, logo_url, image_url, created_by } = evnt.data;
      await createCommunity(id, name, slug, logo_url || image_url, "org bio", created_by);
      return NextResponse.json({ message: "Organization created" }, { status: 201 });
    }

    if (eventType === "organizationInvitation.created") {
      console.log("Invitation created:", evnt.data);
      return NextResponse.json({ message: "Invitation created" }, { status: 201 });
    }

    if (eventType === "organizationMembership.created") {
      const { organization, public_user_data } = evnt.data;
      console.log("Membership created:", evnt.data);
      await addMemberToCommunity(organization.id, public_user_data.user_id);
      return NextResponse.json({ message: "Membership created" }, { status: 201 });
    }

    if (eventType === "organizationMembership.deleted") {
      const { organization, public_user_data } = evnt.data;
      console.log("Membership deleted:", evnt.data);
      await removeUserFromCommunity(public_user_data.user_id, organization.id);
      return NextResponse.json({ message: "Membership removed" }, { status: 201 });
    }

    if (eventType === "organization.updated") {
      const { id, logo_url, name, slug } = evnt.data;
      console.log("Organization updated:", evnt.data);
      await updateCommunityInfo(id, name, slug, logo_url);
      return NextResponse.json({ message: "Organization updated" }, { status: 201 });
    }

    if (eventType === "organization.deleted") {
      const { id } = evnt.data;
      console.log("Organization deleted:", evnt.data);
      await deleteCommunity(id);
      return NextResponse.json({ message: "Organization deleted" }, { status: 201 });
    }

  } catch (err) {
    console.error("Internal Server Error:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
};
