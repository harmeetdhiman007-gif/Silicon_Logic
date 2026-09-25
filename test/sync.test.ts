import { neon } from '@neondatabase/serverless';

const url =
  'postgresql://SiLo_app:***@ep-steep-sea-b3tod37c-pooler.c-4.ap-southeast-1.aws.neon.tech/SiLo?sslmode=require';

const sql = neon(url);

async function main() {
  const id = 'test-device-' + Date.now();
  await sql`INSERT INTO players (id, nickname, xp) VALUES (${id}, 'TestBot', 120) ON CONFLICT (id) DO NOTHING`;

  const rows = await sql`SELECT * FROM players WHERE id = ${id}`;
  console.log('Inserted:', JSON.stringify(rows[0]));

  await sql`UPDATE players SET xp = 250 WHERE id = ${id}`;
  const updated = await sql`SELECT xp FROM players WHERE id = ${id}`;
  console.log('Updated XP:', updated[0].xp);

  await sql`INSERT INTO completed_lessons (player_id, lesson_id) VALUES (${id}, 'l1') ON CONFLICT DO NOTHING`;
  const ls = await sql`SELECT lesson_id FROM completed_lessons WHERE player_id = ${id}`;
  console.log('Completed lessons:', ls.map((r) => r.lesson_id));

  const top = await sql`SELECT nickname, xp FROM players ORDER BY xp DESC LIMIT 3`;
  console.log('Leaderboard top 3:', JSON.stringify(top));

  await sql`DELETE FROM completed_lessons WHERE player_id = ${id}`;
  await sql`DELETE FROM players WHERE id = ${id}`;
  console.log('Cleanup done. All sync operations OK.');
}

main().catch((e) => {
  console.error('SYNC TEST FAILED:', e);
  process.exit(1);
});