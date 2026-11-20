import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Read-only access to the portfolio's analytics database (tables `hits` and
// `events`, owned and migrated by the portfolio project). This app never
// writes to it.

let client: NeonQueryFunction<false, false> | null = null;

function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client ??= neon(url);
  return client;
}

export async function query<T>(text: string, params: unknown[]): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}
