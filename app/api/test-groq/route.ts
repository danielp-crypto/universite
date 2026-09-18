import { NextResponse } from "next/server";
import { groq } from "@/lib/groq";

export async function GET() {
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content: "You are Universite, an AI study assistant for university students.",
        },
        {
          role: "user",
          content: "Explain photosynthesis in simple terms.",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      response: completion.choices[0]?.message?.content,
    });
  } catch (error) {
    console.error("Groq error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Groq request failed",
      },
      { status: 500 }
    );
  }
}
