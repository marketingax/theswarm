# Quick Start: Paid Missions System

## Prerequisites
- Supabase project (with Service Role key)
- Node.js 18+
- The Swarm repository cloned locally

---

## 1. Apply Database Migration

### Option A: Supabase Dashboard (Recommended for testing)
1. Go to Supabase Dashboard → SQL Editor
2. Open `migrations/003_paid_missions_system.sql`
3. Copy entire file
4. Paste into SQL Editor
5. Click "Run"
6. Verify success (all tables/views created, no errors)

### Option B: Supabase CLI
```bash
cd theswarm
supabase link --project-id your-project-id
supabase db push migrations/003_paid_missions_system.sql
```

---

## 2. Deploy API Code

Copy the following new files into your repository:

1. **Create-Paid Endpoint:**
   ```
   src/app/api/missions/create-paid/route.ts
   ```

2. **Withdraw Endpoint:**
   ```
   src/app/api/agents/withdraw-usd/route.ts
   ```

3. **Updated Endpoints:**
   - `src/app/api/missions/submit/route.ts` (already in repo, needs USD update)
   - `src/app/api/missions/route.ts` (already in repo, needs USD filtering)

4. **Admin Dashboard:**
   ```
   src/app/admin/dashboard/page.tsx
   ```

Deploy to your platform:
```bash
npm run build
npm run deploy
# or: git push (if using auto-deploy)
```

---

## 3. Verify Everything Works

### Test the Create-Paid Endpoint

```bash
# Save your agent ID and wallet address
AGENT_ID="your-agent-uuid"
WALLET="your-solana-wallet"
API_URL="http://localhost:3000" # or your production URL

# Create a paid mission
curl -X POST ${API_URL}/api/missions/create-paid \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'${AGENT_ID}'",
    "wallet_address": "'${WALLET}'",
    "mission_type": "youtube_subscribe",
    "target_url": "https://youtube.com/c/testchannel",
    "target_name": "Test Channel",
    "target_count": 10,
    "usd_budget": 10.00,
    "usd_reward_per_completion": 1.00
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mission": {
    "id": 123,
    "usd_budget": 10.00,
    "usd_reward_per_completion": 1.00,
    "status": "active"
  },
  "usd_deducted": 10.00,
  "remaining_balance": 90.00
}
```

### Test List USD Missions

```bash
curl -s "${API_URL}/api/missions?usdOnly=true" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "missions": [ /* USD missions only */ ],
  "summary": {
    "usd_missions": 1,
    "xp_missions": 5,
    "total_usd_budget": 10.00
  }
}
```

### Test Withdrawal Endpoint

```bash
# Get withdrawal history
curl -s "${API_URL}/api/agents/withdraw-usd?agent_id=${AGENT_ID}&wallet_address=${WALLET}" | jq .

# Request withdrawal (requires Stripe account first!)
curl -X POST ${API_URL}/api/agents/withdraw-usd \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'${AGENT_ID}'",
    "wallet_address": "'${WALLET}'",
    "amount": 50.00
  }'
```

---

## 4. Database Verification

Connect to your Supabase database and verify:

```sql
-- Check new columns were added
SELECT usd_balance, stripe_account_id, usd_withdrawal_threshold 
FROM agents LIMIT 1;

-- Check new table exists
SELECT COUNT(*) FROM transactions WHERE type = 'usd';

-- Check new views exist
SELECT COUNT(*) FROM usd_missions;
SELECT COUNT(*) FROM top_usd_earners;
SELECT COUNT(*) FROM pending_payouts;
```

---

## 5. Admin Dashboard Access

1. Navigate to: `https://yoursite.com/admin/dashboard`
2. You should see:
   - Key metrics (USD Budget, USD Paid, Active Missions)
   - USD Missions table
   - Top USD Earners
   - Pending Payouts queue

---

## 6. Create Test Data

Use the provided test file:

```bash
# With environment variable
API_URL="http://localhost:3000" node test-paid-missions.js

# Or edit BASE_URL in test-paid-missions.js directly
node test-paid-missions.js
```

---

## 7. Key Configuration

### Agent USD Settings
Update agents table as needed:

```sql
-- Set initial USD balance (for testing)
UPDATE agents 
SET usd_balance = 100.00, 
    usd_withdrawal_threshold = 10.00,
    stripe_account_id = 'acct_1234567890' -- Add Stripe Connect ID
WHERE id = 'your-agent-id';
```

### Withdrawal Threshold
Default is $10, customize per agent:

```sql
UPDATE agents 
SET usd_withdrawal_threshold = 25.00 
WHERE id = 'your-agent-id';
```

---

## 8. Troubleshooting

### Error: "Insufficient USD balance"
- Check agent's `usd_balance` in database
- Note: Balance includes both available + escrowed funds
- To add USD: `UPDATE agents SET usd_balance = usd_balance + 100 WHERE id = 'agent-id'`

### Error: "Stripe account not configured"
- Agent needs `stripe_account_id` to withdraw
- Setup: Connect Stripe account and store ID in database
- For testing: Manually set to test account ID

### Withdrawal "pending" forever
- Check `pending_withdrawals` table
- Stripe webhook may not be configured (see Stripe setup)
- For testing: Manually update status: `UPDATE pending_withdrawals SET status = 'completed' WHERE id = 1`

### Budget mismatch error
- Ensure: `usd_budget == usd_reward_per_completion * target_count`
- Example: 10 tasks * $1.00 = $10.00 ✓

---

## 9. Documentation

Read these files for detailed info:

1. **API.md** - All endpoints with examples
2. **PAID_MISSIONS_IMPLEMENTATION.md** - Full technical guide
3. **test-paid-missions.js** - Test scenarios and usage

---

## 10. Production Checklist

Before going live:

- [ ] Database migration applied successfully
- [ ] All 4 endpoints deployed and tested
- [ ] Admin dashboard accessible
- [ ] Test created USD mission successfully
- [ ] Test claim and proof submission
- [ ] Stripe integration configured (if using real payouts)
- [ ] Withdrawal webhook configured
- [ ] Email notifications set up
- [ ] Rate limiting configured
- [ ] Security audit passed

---

## Support

**For questions or issues:**
1. Check troubleshooting section above
2. Review API.md for endpoint details
3. Check database schema in migrations/003_*
4. Run test suite: `node test-paid-missions.js`

---

## What's Next?

### Phase 1 (Done)
✅ USD mission creation
✅ USD claim verification
✅ USD withdrawals
✅ Admin dashboard
✅ API documentation

### Phase 2 (Coming)
- Stripe webhook integration
- Automated withdrawal processing
- Email notifications
- Agent onboarding flow

### Phase 3 (Future)
- Multi-currency support
- Fraud detection
- Premium mission tiers
- Earnings analytics

---

**Start Date:** 2026-02-14
**Status:** ✅ Ready for testing
