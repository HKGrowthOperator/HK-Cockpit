import { NextResponse } from "next/server";
import { listFiles } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const files = await listFiles(q);
    return NextResponse.json({ files });
  } catch (err) {
    const m = (err as Error).message;
    return NextResponse.json({ error: m === "not-connected" ? "not-connected" : m, files: [] }, { status: 200 });
  }
}
