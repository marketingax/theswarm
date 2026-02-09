const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.mmdmqhftpesjnynyhsyv:a2yRXI3iWSVeNxbk@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase...\n');
  
  // Drop existing tables if they exist (in reverse dependency order)
  await client.query(`DROP TABLE IF EXISTS audits CASCADE`);
  await client.query(`DROP TABLE IF EXISTS claims CASCADE`);
  await client.query(`DROP TABLE IF EXISTS missions CASCADE`);
  console.log('0. Dropped existing tables');

  // Step 1: Add columns to agents
  await client.query(`
    ALTER TABLE agents 
    ADD COLUMN IF NOT EXISTS trust_tier TEXT DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS fraud_flags INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS audit_rate DECIMAL(3,2) DEFAULT 0.10,
    ADD COLUMN IF NOT EXISTS probation_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_claims INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS verified_claims INTEGER DEFAULT 0
  `);
  console.log('1. Added trust columns to agents');

  // Step 2: Create missions table (no FK for now - session pooler issue)
  await client.query(`
    CREATE TABLE missions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_url TEXT,
      target_channel_id TEXT,
      xp_reward INTEGER NOT NULL,
      stake_required INTEGER NOT NULL,
      creator_id UUID,
      status TEXT DEFAULT 'open',
      max_claims INTEGER DEFAULT 1,
      current_claims INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
  console.log('2. Created missions table');

  // Step 3: Create claims table
  await client.query(`
    CREATE TABLE claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID,
      agent_id UUID,
      status TEXT DEFAULT 'pending',
      staked_xp INTEGER NOT NULL,
      proof_url TEXT,
      proof_notes TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      audit_result TEXT,
      auditor_id UUID,
      audited_at TIMESTAMPTZ,
      UNIQUE(mission_id, agent_id)
    )
  `);
  console.log('3. Created claims table');

  // Step 4: Create audits table
  await client.query(`
    CREATE TABLE audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID,
      auditor_id UUID,
      verdict TEXT NOT NULL,
      evidence_notes TEXT,
      xp_earned INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('4. Created audits table');

  // Step 5: Create indexes
  await client.query(`CREATE INDEX idx_claims_status ON claims(status)`);
  await client.query(`CREATE INDEX idx_claims_agent ON claims(agent_id)`);
  await client.query(`CREATE INDEX idx_missions_status ON missions(status)`);
  await client.query(`CREATE INDEX idx_agents_trust ON agents(trust_tier)`);
  console.log('5. Created indexes');

  // Step 6: Enable RLS
  await client.query(`ALTER TABLE missions ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE claims ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE audits ENABLE ROW LEVEL SECURITY`);
  console.log('6. Enabled RLS');

  // Step 7: Create policies
  await client.query(`CREATE POLICY "Allow all missions" ON missions FOR ALL USING (true)`);
  await client.query(`CREATE POLICY "Allow all claims" ON claims FOR ALL USING (true)`);
  await client.query(`CREATE POLICY "Allow all audits" ON audits FOR ALL USING (true)`);
  console.log('7. Created RLS policies');

  console.log('\n✅ Trust system migration complete!');
  console.log('\nTables created:');
  console.log('  - missions (work agents can do)');
  console.log('  - claims (agent claims they did work)');
  console.log('  - audits (verification records)');
  console.log('\nAgents table updated with:');
  console.log('  - trust_tier (trusted/normal/probation/blacklist/banned)');
  console.log('  - fraud_flags (count)');
  console.log('  - audit_rate (5%/10%/50%/100%)');
  console.log('  - probation_until (90 days from fraud)');
  console.log('\nNote: FKs skipped due to session pooler. Add via Supabase dashboard if needed.');
  
  await client.end();
}

run().catch(e => { 
  console.error('Error:', e.message); 
  process.exit(1); 
});
