import postgres from 'postgres';

const sql = postgres('postgresql://postgres:postgres@localhost:5432/smart_tender_review');

async function migrate() {
  try {
    console.log('Adding task tracking fields to documents table...');

    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS mineru_task_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS task_progress INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS task_submitted_at TIMESTAMP
    `;

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
}

migrate();