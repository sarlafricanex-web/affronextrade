import { NextResponse } from "next/server";
import { saveReview, getReviews, getProducerRatings, initReviews } from "@/lib/db";

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

export async function POST(request: Request) {
  if (!dbReady) {
    dbReady = (await initReviews()) ?? false;
  }

  let data: Record<string, string>;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { producerId, authorName, authorCompany, authorCountry, rating, comment } = data;

  if (!producerId || !authorName || !rating) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Note entre 1 et 5" }, { status: 400 });
  }

  const commentClean = (comment ?? "").slice(0, 1000);
  const nameClean = authorName.slice(0, 100);
  const companyClean = (authorCompany ?? "").slice(0, 100);
  const countryClean = (authorCountry ?? "").slice(0, 100);

  const result = await saveReview({
    producerId,
    authorName: nameClean,
    authorCompany: companyClean,
    authorCountry: countryClean,
    rating: ratingNum,
    comment: commentClean,
  });

  if (!result) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
