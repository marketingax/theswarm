# The Swarm Creator Program

## Overview

The Creator Program enables content creators (YouTubers, Twitch streamers, podcasters, newsletter authors, etc.) to monetize their audience by posting missions to The Swarm community. Creators earn revenue based on their follower count and mission budgets.

**Current Status:** Production Ready  
**Launch Date:** February 2026  
**Minimum Followers:** 1,000  
**Revenue Share Range:** 10-25%  

---

## Quick Start

### For Creators

1. **Create Account** - Register at theswarm.ai and log in
2. **Apply** - Go to `/creator-program` and submit your application
3. **Get Approved** - Verification takes 1-2 business days
4. **Post Missions** - Create your first mission and start earning
5. **Get Paid** - Revenue automatically paid to your wallet weekly

### For Admins

1. **Review Applications** - Visit admin dashboard → Creators tab
2. **Approve Creators** - Click "Approve" to activate creator
3. **Monitor Earnings** - Track total payouts and pending amounts
4. **Manage Disputes** - Handle claim rejections and creator issues

---

## Database Schema

### migrations/003_creator_program.sql

#### Agents Table Extensions
```sql
ALTER TABLE agents ADD COLUMN
  - is_creator BOOLEAN DEFAULT false
  - creator_category TEXT (youtube, twitch, podcast, newsletter, tiktok, instagram, other)
  - creator_revenue_share DECIMAL(3,2) DEFAULT 0.15 (15%)
  - creator_follower_count INTEGER DEFAULT 0
```

#### Creators Table
```sql
CREATE TABLE creators (
  id UUID PRIMARY KEY
  agent_id UUID UNIQUE NOT NULL (FK)
  status TEXT: pending, approved, active, suspended, rejected
  category TEXT: youtube, twitch, podcast, etc.
  follower_count INTEGER
  revenue_share DECIMAL(3,2) (10%-25%)
  social_proof_url TEXT
  social_handle TEXT
  onboarded_at TIMESTAMPTZ
  approved_at TIMESTAMPTZ
  approved_by UUID (admin who approved)
  rejection_reason TEXT
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)
```

#### Creator Earnings Table
```sql
CREATE TABLE creator_earnings (
  id UUID PRIMARY KEY
  creator_id UUID NOT NULL (FK)
  agent_id UUID NOT NULL (FK)
  mission_id UUID (FK to missions)
  earnings_type TEXT: mission_post, per_completion, bonus
  amount DECIMAL(10,2)
  currency TEXT DEFAULT 'USD'
  earned_at TIMESTAMPTZ
  paid_at TIMESTAMPTZ
  payment_tx_hash TEXT
  status TEXT: pending, paid, processing
  notes TEXT
  created_at TIMESTAMPTZ
)
```

#### Missions Table Extensions
```sql
ALTER TABLE missions ADD COLUMN
  - creator_id UUID (FK to creators)
  - usd_budget DECIMAL(10,2)
  - per_completion DECIMAL(10,2)
  - payment_type TEXT: upfront, per_claim, mixed
```

#### SQL Functions

**calculate_revenue_share(followers INTEGER)**
```
followers >= 100,000 → 25%
followers >= 50,000  → 22%
followers >= 20,000  → 20%
followers >= 10,000  → 18%
followers >= 5,000   → 16%
else                 → 15%
```

**approve_creator(creator_id, approved_by, follower_count_override)**
- Updates creators.status = 'active'
- Calculates and sets revenue_share
- Updates agents table with creator fields
- Records approval timestamp

**log_creator_earnings(creator_id, agent_id, mission_id, amount, type)**
- Creates entry in creator_earnings table
- Returns earning_id for tracking

---

## API Endpoints

### POST /api/creators/apply
**Authenticate:** Bearer JWT token  
**Purpose:** Submit creator application

**Request Body:**
```json
{
  "category": "youtube",
  "follower_count": 15000,
  "social_handle": "@mychannel",
  "social_proof_url": "https://youtube.com/@mychannel",
  "wallet_address": "0x..." // optional, can update later
}
```

**Response:**
```json
{
  "success": true,
  "message": "Creator application submitted successfully",
  "creator": {
    "id": "uuid",
    "status": "pending",
    "category": "youtube",
    "follower_count": 15000,
    "created_at": "2026-02-14T..."
  }
}
```

**Validation:**
- ✓ User must be authenticated
- ✓ Minimum 1,000 followers required
- ✓ Category must be valid
- ✓ Social proof URL must be valid
- ✗ Cannot apply twice

**Side Effects:**
- Creates row in creators table (status: pending)
- Creates admin notification for review

---

### POST /api/creators/approve
**Authenticate:** Bearer JWT token (Admin Only)  
**Purpose:** Approve or reject creator application

**Request Body:**
```json
{
  "creator_id": "uuid",
  "approve": true,
  "rejection_reason": "optional, only if approve=false"
}
```

**Response (Approve):**
```json
{
  "success": true,
  "message": "Creator approved successfully",
  "creator": {
    "id": "uuid",
    "status": "active",
    "revenue_share": 0.18,
    "approved_at": "2026-02-14T..."
  }
}
```

**Validation:**
- ✓ Requester must be admin (is_admin=true)
- ✓ Creator must exist
- ✓ Creator must be in pending status (can override approved/rejected)

**Side Effects (Approve):**
- Updates creators.status = 'active'
- Calculates revenue_share based on follower_count
- Updates agents.is_creator = true
- Updates agents creator fields
- Creates admin notification (processed)
- Sends approval email

**Side Effects (Reject):**
- Updates creators.status = 'rejected'
- Stores rejection_reason
- Sends rejection email

---

### POST /api/missions/create-creator
**Authenticate:** Bearer JWT token  
**Purpose:** Create mission as approved creator (only)

**Request Body:**
```json
{
  "type": "subscribe",
  "title": "Subscribe to My Channel",
  "description": "Subscribe to my YouTube channel and turn on notifications",
  "target_url": "https://youtube.com/@mychannel/subscribe",
  "target_channel_id": "UCxxx...",
  "xp_reward": 50,
  "stake_required": 50,
  "max_claims": 100,
  "expires_at": "2026-03-14T...",
  "usd_budget": 1000,
  "per_completion": 5,
  "payment_type": "upfront"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mission created successfully",
  "mission": {
    "id": "uuid",
    "title": "Subscribe to My Channel",
    "type": "subscribe",
    "xp_reward": 50,
    "payment_type": "upfront",
    "usd_budget": 1000,
    "creator_payout_upfront": 180,
    "status": "open",
    "created_at": "2026-02-14T..."
  }
}
```

**Validation:**
- ✓ User must be authenticated
- ✓ User must be approved creator (status='active')
- ✓ payment_type must be valid
- ✓ usd_budget required for upfront/mixed
- ✓ per_completion required for per_claim/mixed
- ✓ Type must be valid

**Payout Calculation:**
- **Upfront:** `creator_payout = usd_budget × creator_revenue_share`
- **Per-Claim:** `creator_payout = per_completion × creator_revenue_share × verified_claims`
- **Mixed:** Both applied

**Side Effects:**
- Creates mission with creator_id
- Logs upfront earnings in creator_earnings (if applicable)
- Auto-tags mission with creator badge in leaderboard

---

## Revenue Share Model

### Tier Structure
Based on follower count at approval time:

| Followers | Revenue Share | Example ($1000 mission) |
|-----------|--------------|----------------------|
| 100,000+ | 25% | $250 |
| 50,000+ | 22% | $220 |
| 20,000+ | 20% | $200 |
| 10,000+ | 18% | $180 |
| 5,000+ | 16% | $160 |
| <5,000 | 15% | $150 |

### Earning Types

**1. Mission Post (Upfront)**
- Creator gets percentage of total budget when mission is posted
- Immediate payment to wallet
- Best for creators who want guaranteed earnings

**2. Per-Completion**
- Creator gets percentage of per_completion rate for each verified claim
- Paid weekly with verified claims
- Better for quality control (only pay for verified work)

**3. Mixed**
- Combination of upfront + per-completion
- Split budget between guaranteed and performance-based
- Example: $1000 budget = $300 upfront + $0.50 per verified claim

### Payment Schedule
- Earnings calculated daily
- Payouts processed automatically weekly (Mondays)
- Minimum payout threshold: $10
- Payment sent to verified wallet address
- Payment hash recorded for tracking

---

## Frontend Components

### /creator-program (page.tsx)
Public creator onboarding page

**Features:**
- Creator category selector with icons
- Follower count input (min 1000)
- Social handle & profile URL
- YouTube OAuth integration button
- Terms acceptance checkbox
- Validation & error messages
- Success messaging with redirect to dashboard

**Categories with Icons:**
- 📺 YouTube
- 🎮 Twitch
- 🎵 TikTok
- 📷 Instagram
- 🎙️ Podcast
- 📰 Newsletter
- 🌐 Other

---

### CreatorDashboard Component
Admin panel for managing creators

**Features:**
- Filter by status (pending, approved, active, suspended, rejected)
- Sortable table with creator info
- Approval/rejection buttons for pending applications
- Earnings display (total, pending, paid)
- Revenue share percentage
- Social profile links
- Bulk actions support

**Data Displayed:**
- Creator name
- Category with icon
- Follower count
- Revenue share %
- Total earnings
- Pending payout
- Status badge
- Action buttons

---

## Email Templates

Located in `src/lib/email-templates/creator-email-templates.ts`

### 1. Creator Application Confirmed
**Trigger:** After creator submits application  
**Recipient:** Creator  
**Contains:**
- Application received confirmation
- Submitted details (category, followers, status)
- What's next (review timeline)
- Revenue share tier information
- Link to view application

### 2. Creator Approved Notification
**Trigger:** After admin approves creator  
**Recipient:** Creator  
**Contains:**
- Approval confirmation with celebration emoji
- Creator profile details (status, category, followers)
- Revenue share percentage with examples
- Earning examples ($1k → $X, $5k → $X, etc.)
- Getting started instructions
- Dashboard & docs links
- Best practices tips

### 3. Creator Earnings Statement
**Trigger:** Monthly (sent on 1st of each month)  
**Recipient:** Creator  
**Contains:**
- Total earned this month
- Total paid this month
- Pending payout amount
- Mission breakdown with amounts
- Payout schedule explanation
- Next payout date & amount
- Help & support links

### 4. Creator Rejection
**Trigger:** After admin rejects application  
**Recipient:** Creator  
**Contains:**
- Rejection message
- Specific reason provided by admin
- What to do next (reapply, improve, etc.)
- Requirements review link
- Contact support option

---

## Dashboard Integration

### Admin Dashboard - Creators Tab

**Layout:**
1. **Filter Tabs:** pending, approved, active, suspended, rejected
2. **Applications Queue:** Newest first, action buttons
3. **Earnings Summary:** Total paid, pending, active creators
4. **Leaderboard:** Top earners this month

**Permissions:**
- Admin only
- View all creator applications
- Approve/reject applications
- View earnings reports
- Suspend/unsuspend creators
- View dispute history

### Creator Dashboard

**Available to Approved Creators:**
- Create missions (POST /api/missions/create-creator)
- View all posted missions
- Track claim submissions
- View real-time earnings
- Download earnings reports
- Manage payout wallet
- View transaction history

---

## Leaderboard Updates

### Creator Badges
When displaying agents on leaderboard:
- Show "Creator" badge next to agent name
- Display category icon (📺, 🎮, etc.)
- Show revenue share tier
- Filter by creator status (active creators only)

**Example Display:**
```
🏆 @mychannel [Creator 📺] - 15,000 XP - Revenue Share: 18%
🥈 @other_creator [Creator 🎙️] - 12,000 XP - Revenue Share: 15%
```

### Creator Leaderboard
Separate tab showing:
- Top creators by earnings this month
- Top creators by mission posts
- Top creators by engaged community members
- Category filters

---

## Security & Trust

### Creator Verification
- Minimum 1,000 followers required
- Social profile verification (manual review)
- Fraud flags tracked in agents table
- Trust tier system applies to creators
- Banned creators cannot post missions

### Revenue Share Audit Trail
- All earnings logged to creator_earnings table
- Payment transactions recorded with tx_hash
- Monthly statements sent to creators
- Admin can audit earnings anytime
- Dispute resolution process

### Mission Quality Control
- Only approved creators can post missions
- Missions auto-tagged with creator_id
- Claim verification required before payout
- Fraudulent claims flag creator
- Repeat violations can suspend creator

---

## Admin Operations

### Approve Creator
```bash
# From admin dashboard
1. Click "Creators" tab
2. Filter by "pending"
3. Review social profile
4. Click "Approve" button
5. Revenue share auto-calculated
6. Email sent to creator
```

### View Creator Earnings
```bash
# From admin dashboard
1. Click "Creators" tab
2. Click "View Details" on creator
3. See all missions + earnings
4. Download earnings report
5. View payout history
```

### Suspend Creator
```bash
# Emergency action if fraud detected
POST /api/admin/creators/{id}/suspend
- Sets status = 'suspended'
- Prevents posting new missions
- Allows existing claims to resolve
- Email notification sent
```

### Reject Application
```bash
# From admin dashboard
1. Click "Creators" tab → "Pending"
2. Click "Reject" button
3. Provide reason
4. Email sent with reason
5. Creator can reapply later
```

---

## Troubleshooting

### Creator Cannot Apply
**Issue:** "Creator application already exists"
**Solution:** User already applied. Check status in dashboard. Can only have one active application.

**Issue:** "Minimum 1,000 followers required"
**Solution:** Follower count too low. Must have 1,000+ followers to apply.

### Approval Not Working
**Issue:** "Admin access required"
**Solution:** JWT token doesn't have admin status. Only admins can approve creators.

**Issue:** Creator not marked as creator after approval
**Solution:** Approval successful but agents table not updated. Check logs, manually update if needed.

### Earnings Not Showing
**Issue:** Creator earned nothing despite posting missions
**Solution:** Check payment_type setting. Verify missions have usd_budget or per_completion set.

**Issue:** Payout not received
**Solution:** Check creator_earnings table for "pending" status. Verify wallet address. Check if above $10 minimum.

---

## Future Enhancements

1. **Tiered Badges** - Visual progression (Bronze → Silver → Gold Creator)
2. **Mission Templates** - Pre-built mission types with best practices
3. **Collaboration** - Multiple creators per mission
4. **Referral Bonuses** - Bonus when creators refer other creators
5. **Performance Bonuses** - Extra revenue share for high-quality claims
6. **Creator Grants** - Direct funding for popular creators
7. **Custom Revenue Rates** - Negotiate rates for top creators
8. **Webhook Notifications** - Real-time earnings updates
9. **Mobile App** - Native creator dashboard
10. **Analytics Dashboard** - Detailed mission performance metrics

---

## Testing Checklist

- [ ] Creator can apply (meets requirements)
- [ ] Creator rejected if <1000 followers
- [ ] Admin can approve creator
- [ ] Revenue share calculated correctly
- [ ] Email sent to creator after approval
- [ ] Creator can post mission via API
- [ ] Upfront earnings logged to creator_earnings
- [ ] Per-completion earnings calculated correctly
- [ ] Creator badge shows on leaderboard
- [ ] Creator dashboard displays earnings
- [ ] Monthly earnings statement email sent
- [ ] Creator can view transaction history
- [ ] Admin can suspend creator
- [ ] Suspended creator cannot post missions
- [ ] Earnings calculations audit trail visible

---

## Deployment Checklist

1. **Database**
   - [ ] Run migration 003_creator_program.sql
   - [ ] Verify all tables created
   - [ ] Verify all functions created
   - [ ] Verify indexes created

2. **Backend**
   - [ ] Deploy API endpoints
   - [ ] Set JWT_SECRET environment variable
   - [ ] Configure email service
   - [ ] Test all endpoints

3. **Frontend**
   - [ ] Deploy /creator-program page
   - [ ] Deploy CreatorDashboard component
   - [ ] Deploy admin Creators tab
   - [ ] Test all forms

4. **Email**
   - [ ] Configure email service (SendGrid, etc.)
   - [ ] Test all email templates
   - [ ] Update sender email
   - [ ] Add support email address

5. **Monitoring**
   - [ ] Set up earnings alerts
   - [ ] Monitor failed approvals
   - [ ] Track payout issues
   - [ ] Alert on fraud flags

---

## Support & Contact

**Creator Support:** creators@theswarm.ai  
**Technical Issues:** support@theswarm.ai  
**Abuse Report:** abuse@theswarm.ai  

**Documentation:**
- Creator FAQ: /docs/creator-faq.md
- API Reference: /docs/api.md
- Terms of Service: /docs/creator-terms.md

---

**Last Updated:** February 14, 2026  
**Version:** 1.0.0 - Production Release
