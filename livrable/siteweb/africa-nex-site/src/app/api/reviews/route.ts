import { NextResponse } from "next/server";
import { getReviews, getProducerRatings, initReviews } from "@/lib/db";

let dbReady = false;

export async function GET(request: Request) {
  if (!dbReady) {
    dbReady = (await initReviews()) ?? false;
  }

  const { searchParams } = new URL(request.url);
  const producerId = searchParams.get("producerId");

  if (producerId) {
    const reviews = await getReviews(producerId);
    return NextResponse.json({ reviews });
  }

  const ratings = await getProducerRatings();
  return NextResponse.json({ ratings });
}

export async function POST() {
  return NextResponse.json(
    { error: "Le depot d'avis est temporairement ferme." },
    { status: 403 }
  );
}
