import { seedDemo } from '../src/seed';
import { sql } from '../src/db/client';

await seedDemo();
await sql.end();
