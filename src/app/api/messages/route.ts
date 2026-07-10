import { NextResponse } from "next/server";
import { addMessage, getLatestMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

    const messages = await getLatestMessages(
      Number.isFinite(limit) && limit > 0 ? limit : 50
    );
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const photo = typeof body.photo === "string" ? body.photo : "";
    const text = typeof body.text === "string" ? body.text : "";

    const message = await addMessage({ name, photo, text });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const messages = await getLatestMessages(
      Number.isFinite(limit) && limit > 0 ? limit : 50
    );

    return NextResponse.json({ message, messages }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message";
    const status =
      message.includes("required") ||
      message.includes("long") ||
      message.includes("Invalid") ||
      message.includes("large")
        ? 400
        : 500;
    console.error("POST /api/messages:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
