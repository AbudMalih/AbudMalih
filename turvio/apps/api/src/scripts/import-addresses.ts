/**
 * Import addresses produced by tools/osm_addresses.py into geo.addresses.
 *   DATABASE_URL=… npx tsx src/scripts/import-addresses.ts addresses.csv [--replace]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import pg from "pg";

const [file, flag] = process.argv.slice(2);
if (!file || !process.env.DATABASE_URL) {
  console.error("usage: DATABASE_URL=… import-addresses.ts <file.csv> [--replace]");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
await client.connect();
if (flag === "--replace") await client.query("truncate geo.addresses");
let batch: string[][] = [];
let total = 0;
const flush = async () => {
  if (!batch.length) return;
  const values: unknown[] = [];
  const tuples = batch.map((r, i) => {
    values.push(...r);
    const o = i * 6;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}::float8, $${o + 6}::float8)`;
  });
  await client.query(`insert into geo.addresses (street, house_number, postcode, city, lat, lng) values ${tuples.join(",")} on conflict do nothing`, values);
  total += batch.length;
  batch = [];
};
let header = true;
for await (const line of createInterface({ input: createReadStream(file) })) {
  if (header) {
    header = false;
    continue;
  }
  const cols = line.split(";");
  if (cols.length !== 6 || !/^\d{5}$/.test(cols[2]!)) continue;
  batch.push(cols);
  if (batch.length >= 1000) await flush();
}
await flush();
console.log(`imported ${total} rows into geo.addresses`);
await client.end();
