// Seeds the LOCAL development database with synthetic data.
//   pnpm --filter @turvio/api seed            (empty database required; see scripts/db.sh reset)
//   SEED_DATABASE_URL=... SEED_PASSWORD=... SEED_DEMO_DAY=false pnpm --filter @turvio/api seed
import pg from "pg";
import { SEED_PASSWORD_DEFAULT, SEED_USERS, seed } from "../seed";

const url = process.env.SEED_DATABASE_URL ?? "postgres://postgres@localhost/turvio?host=/tmp&port=54329";
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const existing = await client.query(`select count(*)::int as n from organizations`);
  if (existing.rows[0].n > 0) throw new Error("Database is not empty – run scripts/db.sh reset first");
  await client.query("begin");
  await seed(client, { password: process.env.SEED_PASSWORD ?? SEED_PASSWORD_DEFAULT, demoDay: process.env.SEED_DEMO_DAY !== "false" });
  await client.query("commit");
  console.log("Seeded synthetic data. Accounts (password from SEED_PASSWORD, default shown in docs):");
  for (const [role, email] of Object.entries(SEED_USERS)) console.log(`  ${role.padEnd(20)} ${email}`);
} catch (e) {
  await client.query("rollback").catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
