import { NextResponse } from "next/server";

// Les avis s'affichent sur la fiche producteur (rendu serveur). Le depot d'avis rouvrira
// pour les acheteurs connectes, avec validation par AFRICA NEX.
export async function POST() {
  return NextResponse.json(
    { error: "Le depot d'avis est temporairement ferme." },
    { status: 403 }
  );
}
