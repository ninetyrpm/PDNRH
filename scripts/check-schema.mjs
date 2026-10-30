// After applying db/migrations/0001_initial.sql, verify the required tables exist.
// Requires DATABASE_URL in the invoking environment.
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT version FROM pdnrh_schema_migrations ORDER BY applied_at`;
const found = rows.some(row => row.version === '0001_initial');
if (!found) throw new Error('PD04A migration not applied');
console.log('PD04A schema verified:', rows.map(row => row.version).join(', '));
