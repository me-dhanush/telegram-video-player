import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();

    const { telegramChatId, messageId, time, text } = body;

    if (!telegramChatId || !messageId || time === undefined || !text) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    const video = await prisma.video.findUnique({
      where: {
        telegramChatId_messageId: {
          telegramChatId,
          messageId: Number(messageId),
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "Video not found in database",
        },
        { status: 404 },
      );
    }

    const note = await prisma.note.create({
      data: {
        time: Number(time),
        text,
        videoId: video.id,
      },
    });

    console.log("✅ Note saved!");
    console.log("Note ID:", note.id);

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("❌ Note creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const telegramChatId = searchParams.get("telegramChatId");
    const messageId = searchParams.get("messageId");

    if (!telegramChatId || !messageId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    const video = await prisma.video.findUnique({
      where: {
        telegramChatId_messageId: {
          telegramChatId,
          messageId: Number(messageId),
        },
      },
      include: {
        notes: {
          orderBy: {
            time: "asc",
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "Video not found in database",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      notes: video.notes,
    });
  } catch (error) {
    console.error("❌ Notes fetch failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing note id",
        },
        { status: 400 },
      );
    }

    await prisma.note.delete({
      where: {
        id,
      },
    });

    console.log("✅ Note deleted:", id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("❌ Note deletion failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing note id",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { time, text } = body;

    if (time === undefined || !text) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    const note = await prisma.note.update({
      where: {
        id,
      },
      data: {
        time: Number(time),
        text,
      },
    });

    console.log("✅ Note updated:", note.id);

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("❌ Note update failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}