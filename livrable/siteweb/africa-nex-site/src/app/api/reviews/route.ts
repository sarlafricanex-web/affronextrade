import { NextResponse } from "next/server";
import { getProducerRatings, getReviews } from "@/lib/data/reviews";

export async function GET(request: Request) {
  const producerId = new URL(request.url).searchParams.get("producerId");

  try {
    if (producerId) {
      return NextResponse.json({ reviews: await getReviews(producerId) });
    }
    return NextResponse.json({ ratings: await getProducerRatings() });
  } catch (e) {
    console.error("Reviews error:", e);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Le depot d'avis est temporairement ferme." },
    { status: 403 }
  );
}
