import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export async function initDb() {
  const sql = getDb();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      country TEXT,
      phone TEXT,
      whatsapp TEXT,
      message TEXT,
      consent BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  return true;
}

export async function saveSubmission(data: {
  name: string;
  email: string;
  company?: string;
  country?: string;
  phone?: string;
  whatsapp?: string;
  message?: string;
}) {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`
    INSERT INTO submissions (name, email, company, country, phone, whatsapp, message)
    VALUES (${data.name}, ${data.email}, ${data.company ?? ""}, ${data.country ?? ""}, ${data.phone ?? ""}, ${data.whatsapp ?? ""}, ${data.message ?? ""})
    RETURNING id, created_at
  `;
  return rows[0];
}

export async function getSubmissions(limit = 100, offset = 0) {
  const sql = getDb();
  if (!sql) return [];
  return sql`
    SELECT * FROM submissions
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function countSubmissions() {
  const sql = getDb();
  if (!sql) return 0;
  const rows = await sql`SELECT COUNT(*)::int AS total FROM submissions`;
  return rows[0].total;
}

// --- Reviews ---

export async function initReviews() {
  const sql = getDb();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      producer_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_company TEXT,
      author_country TEXT,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  return true;
}

export async function saveReview(data: {
  producerId: string;
  authorName: string;
  authorCompany?: string;
  authorCountry?: string;
  rating: number;
  comment?: string;
}) {
  const sql = getDb();
  if (!sql) return null;
  const rows = await sql`
    INSERT INTO reviews (producer_id, author_name, author_company, author_country, rating, comment)
    VALUES (${data.producerId}, ${data.authorName}, ${data.authorCompany ?? ""}, ${data.authorCountry ?? ""}, ${data.rating}, ${data.comment ?? ""})
    RETURNING id, created_at
  `;
  return rows[0];
}

export async function getReviews(producerId: string) {
  const sql = getDb();
  if (!sql) return [];
  return sql`
    SELECT * FROM reviews
    WHERE producer_id = ${producerId}
    ORDER BY created_at DESC
  `;
}

export async function getProducerRatings() {
  const sql = getDb();
  if (!sql) return [];
  return sql`
    SELECT producer_id, AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS review_count
    FROM reviews
    GROUP BY producer_id
  `;
}

const RETENTION_MONTHS = 12;

export async function purgeOldSubmissions() {
  const sql = getDb();
  if (!sql) return 0;
  const rows = await sql`
    DELETE FROM submissions
    WHERE created_at < NOW() - INTERVAL '1 month' * ${RETENTION_MONTHS}
    RETURNING id
  `;
  return rows.length;
}
