// Email templates for Creator Program

export const creatorApplicationConfirmedEmail = (creatorName: string, category: string, followerCount: number): string => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-right: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to The Swarm Creator Program! 🚀</h1>
    </div>
    <div class="content">
      <p>Hi ${creatorName},</p>
      
      <p>Thank you for applying to The Swarm Creator Program! We're excited to have you on board.</p>
      
      <h2>Application Received ✓</h2>
      <p>Your application has been successfully submitted with the following details:</p>
      
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6;">
        <p><strong>Creator Category:</strong> <span class="badge">${category.charAt(0).toUpperCase() + category.slice(1)}</span></p>
        <p><strong>Follower Count:</strong> ${followerCount.toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="badge" style="background: #fef3c7; color: #92400e;">Pending Review</span></p>
      </div>
      
      <h2>What's Next?</h2>
      <p>Our team will review your application within 1-2 business days. We verify that:</p>
      <ul>
        <li>Your follower count meets our minimum requirements (1,000+)</li>
        <li>Your social profile is authentic and active</li>
        <li>Your content aligns with community standards</li>
      </ul>
      
      <p>Once approved, you'll receive an email confirmation and can immediately start posting missions to The Swarm!</p>
      
      <h2>Revenue Share Details</h2>
      <p>As an approved creator, your revenue share will be calculated based on your follower count:</p>
      <ul>
        <li><strong>10,000+ followers:</strong> 15-18%</li>
        <li><strong>20,000+ followers:</strong> 20%</li>
        <li><strong>50,000+ followers:</strong> 22%</li>
        <li><strong>100,000+ followers:</strong> 25%</li>
      </ul>
      
      <p style="background: #eff6ff; padding: 15px; border-radius: 6px; color: #1e40af;">
        <strong>💡 Tip:</strong> You'll earn your revenue share immediately when posting a mission (upfront payment) or per verified claim (per-completion payment).
      </p>
      
      <a href="https://theswarm.ai/creator-program" class="button">View Your Application</a>
      
      <p>Questions? Reply to this email or contact our support team at creators@theswarm.ai</p>
      
      <div class="footer">
        <p>© 2026 The Swarm. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const creatorApprovedEmail = (creatorName: string, category: string, revenueShare: number, followerCount: number): string => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .stat { display: inline-block; background: white; padding: 15px; border-radius: 6px; margin: 10px 5px; text-align: center; min-width: 120px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to The Swarm Creator Community!</h1>
      <p style="margin-top: 10px; font-size: 16px;">Your application has been approved</p>
    </div>
    <div class="content">
      <p>Hi ${creatorName},</p>
      
      <p style="font-size: 16px; color: #059669;"><strong>Great news! Your creator application has been approved.</strong> You're now officially part of The Swarm Creator Program.</p>
      
      <h2>Your Creator Profile</h2>
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #d1fae5;">
        <p><strong>Status:</strong> <span class="badge">✓ Active Creator</span></p>
        <p><strong>Category:</strong> ${category.toUpperCase()} ${['youtube', 'twitch', 'tiktok', 'instagram', 'podcast', 'newsletter'].includes(category) ? '(' + { youtube: '📺', twitch: '🎮', tiktok: '🎵', instagram: '📷', podcast: '🎙️', newsletter: '📰' }[category] + ')' : ''}</p>
        <p><strong>Followers:</strong> ${followerCount.toLocaleString()}</p>
      </div>
      
      <h2>Your Revenue Share: <span style="color: #10b981;">${(revenueShare * 100).toFixed(0)}%</span></h2>
      <p>You'll earn <strong>${(revenueShare * 100).toFixed(0)}% of all mission budgets</strong> you post, calculated based on your follower count.</p>
      
      <div style="background: #d1fae5; padding: 15px; border-radius: 6px; color: #065f46; margin: 15px 0;">
        <p><strong>Example Earnings:</strong></p>
        <ul>
          <li>Post a \$1,000 mission → You earn \$${(1000 * revenueShare).toFixed(2)}</li>
          <li>Post a \$5,000 mission → You earn \$${(5000 * revenueShare).toFixed(2)}</li>
          <li>Post a \$10,000 mission → You earn \$${(10000 * revenueShare).toFixed(2)}</li>
        </ul>
      </div>
      
      <h2>Get Started Now</h2>
      <p>You can start posting missions immediately:</p>
      <ol>
        <li>Go to your dashboard</li>
        <li>Click "Create Mission"</li>
        <li>Choose your mission type (subscribe, watch, like, comment, share, or custom)</li>
        <li>Set your budget and earnings will be calculated automatically</li>
        <li>Post and watch your community engage!</li>
      </ol>
      
      <a href="https://theswarm.ai/dashboard" class="button">Go to Dashboard</a>
      <a href="https://theswarm.ai/docs/creator-program" style="display: inline-block; background: #6b7280; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin-left: 10px;">Read Creator Docs</a>
      
      <h2>Creator Tips & Best Practices</h2>
      <ul>
        <li><strong>Be clear:</strong> Write detailed mission descriptions so agents understand exactly what to do</li>
        <li><strong>Be fair:</strong> Set competitive XP rewards to attract quality participants</li>
        <li><strong>Be engaging:</strong> Use calls-to-action that encourage high-quality interactions</li>
        <li><strong>Monitor claims:</strong> Review and verify submissions to maintain quality standards</li>
      </ul>
      
      <h2>Questions?</h2>
      <p>Check out our Creator Program documentation or reach out to us:</p>
      <p>Email: creators@theswarm.ai<br>
      Discord: <a href="https://discord.gg/theswarm">https://discord.gg/theswarm</a></p>
      
      <div class="footer">
        <p>Welcome aboard! 🚀</p>
        <p>© 2026 The Swarm. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const creatorEarningsStatementEmail = (
  creatorName: string,
  month: string,
  totalEarned: number,
  totalPaid: number,
  pendingPayout: number,
  missions: Array<{ title: string; amount: number; date: string }>
): string => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .stat-row { display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .stat-label { color: #666; }
    .stat-value { font-weight: bold; color: #1f2937; }
    .earnings-row { display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #f3f4f6; }
    .mission-title { color: #3b82f6; text-decoration: none; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .summary-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }
    .pending { color: #f59e0b; font-weight: bold; }
    .paid { color: #10b981; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Creator Earnings Statement</h1>
      <p style="margin-top: 10px; font-size: 14px;">${month}</p>
    </div>
    <div class="content">
      <p>Hi ${creatorName},</p>
      
      <p>Here's your earnings summary for ${month}:</p>
      
      <div class="summary-box">
        <div class="stat-row">
          <span class="stat-label">Total Earned:</span>
          <span class="stat-value">\$${totalEarned.toFixed(2)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Paid:</span>
          <span class="stat-value paid">✓ \$${totalPaid.toFixed(2)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Pending Payout:</span>
          <span class="stat-value pending">\$${pendingPayout.toFixed(2)}</span>
        </div>
      </div>
      
      <h2>Mission Earnings Breakdown</h2>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
        <div style="background: #f3f4f6; padding: 12px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>Mission</span>
          <span>Amount</span>
        </div>
        ${missions.map(mission => `
        <div class="earnings-row">
          <span class="mission-title">${mission.title}</span>
          <span>\$${mission.amount.toFixed(2)}</span>
        </div>
        `).join('')}
      </div>
      
      <h2>Payout Schedule</h2>
      <p>Payouts are processed automatically:</p>
      <ul>
        <li><strong>Weekly:</strong> Earnings from the previous week are processed every Monday</li>
        <li><strong>Method:</strong> Direct transfer to your verified wallet address</li>
        <li><strong>Minimum:</strong> \$10 minimum payout threshold</li>
      </ul>
      
      <p style="background: #dbeafe; padding: 12px; border-radius: 6px; color: #1e40af;">
        <strong>💡 Next payout:</strong> Pending earnings of \$${pendingPayout.toFixed(2)} will be paid next week.
      </p>
      
      <a href="https://theswarm.ai/dashboard/earnings" class="button">View Detailed Earnings</a>
      
      <h2>Need Help?</h2>
      <p>If you have questions about your earnings or need to update your payout information:</p>
      <p>Email: creators@theswarm.ai<br>
      Support Portal: <a href="https://theswarm.ai/support">https://theswarm.ai/support</a></p>
      
      <div class="footer">
        <p>Thank you for being part of The Swarm Creator Program!</p>
        <p>© 2026 The Swarm. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const creatorRejectionEmail = (creatorName: string, reason: string): string => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .info-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Creator Application Status Update</h1>
    </div>
    <div class="content">
      <p>Hi ${creatorName},</p>
      
      <p>Thank you for your interest in The Swarm Creator Program. Unfortunately, we're unable to approve your application at this time.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Reason:</h3>
        <p>${reason}</p>
      </div>
      
      <h2>What You Can Do</h2>
      <p>We encourage you to:</p>
      <ul>
        <li><strong>Grow Your Audience:</strong> Build your follower count and reapply in the future</li>
        <li><strong>Improve Your Profile:</strong> Ensure your social profile accurately represents your content</li>
        <li><strong>Check Requirements:</strong> Review our creator guidelines at theswarm.ai/creator-program</li>
        <li><strong>Reapply:</strong> Once you meet our requirements, you're welcome to apply again</li>
      </ul>
      
      <h2>Questions?</h2>
      <p>If you believe this decision was made in error or have questions:</p>
      <p>Email: creators@theswarm.ai<br>
      Please include "Application Review" in your subject line.</p>
      
      <p>We hope to see you in The Swarm Creator Program soon!</p>
      
      <div class="footer">
        <p>© 2026 The Swarm. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
