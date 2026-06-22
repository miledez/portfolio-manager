import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildResearchData } from "@/lib/research";
import { generateAdvice } from "@/lib/advisor";

// Web search + reasoning can take a while; give the route room.
export const maxDuration = 60;

// POST -> { analysis, citations }. Recomputes the deterministic figures
// server-side (so the AI can't be fed bogus numbers) and narrates them.
export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The AI advisor isn't configured." },
      { status: 503 },
    );
  }

  // Require a signed-in session so the key/quota can't be used anonymously.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await buildResearchData(supabase);
    if (data.comparison.length === 0) {
      return NextResponse.json(
        { error: "Add some holdings first — there's nothing to analyze yet." },
        { status: 400 },
      );
    }
    const result = await generateAdvice(data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Couldn't generate the analysis. Try again in a moment." },
      { status: 502 },
    );
  }
}
