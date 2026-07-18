import { NextResponse } from "next/server";
import { openAiProvider, ProviderError } from "@/lib/ai/providers.server";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Unexpected AI provider error." }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json(await openAiProvider.health());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("operation") !== "transcribe") return NextResponse.json({ error: "Unsupported operation." }, { status: 400 });
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "An audio file is required." }, { status: 400 });
      if (audio.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Audio files must be 25 MB or smaller." }, { status: 413 });
      return NextResponse.json({ text: await openAiProvider.transcribe(audio) });
    }

    const body = (await request.json()) as { operation?: string; text?: string; accent?: string; rate?: number; payload?: unknown };
    if (body.operation === "speech") {
      if (!body.text?.trim()) return NextResponse.json({ error: "Speech text is required." }, { status: 400 });
      const audio = await openAiProvider.synthesize(body.text.slice(0, 4096), body.accent || "en-GB", body.rate || 1);
      return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
    }
    if (body.operation === "evaluate") {
      return NextResponse.json(await openAiProvider.evaluate(body.payload));
    }
    return NextResponse.json({ error: "Unsupported operation." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
