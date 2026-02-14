/**
 * Outreach Mission Utilities
 * Helpers for creating, claiming, and verifying outreach missions
 */

export interface OutreachTarget {
  name: string;
  email: string;
  platform_handle?: string;
  company?: string;
}

export interface OutreachMission {
  id: number;
  title: string;
  target_platform: 'email' | 'linkedin' | 'twitter' | 'phone' | 'sms';
  proof_type: 'screenshot' | 'email_header' | 'calendar_invite' | 'call_recording';
  success_criteria: string;
  usd_reward: number;
  requires_disclosure: boolean;
  outreach_template: string;
  target_list: OutreachTarget[];
  status: 'active' | 'completed' | 'paused' | 'pending';
  created_at: string;
}

/**
 * Extract {{placeholders}} from template string
 */
export function extractPlaceholders(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    matches.push(match[1]);
  }

  return [...new Set(matches)];
}

/**
 * Replace placeholders in template with target data
 */
export function fillTemplate(
  template: string,
  target: OutreachTarget
): string {
  let filled = template;

  filled = filled.replace(/\{\{name\}\}/gi, target.name);
  filled = filled.replace(/\{\{email\}\}/gi, target.email);
  filled = filled.replace(/\{\{company\}\}/gi, target.company || '');
  filled = filled.replace(/\{\{platform_handle\}\}/gi, target.platform_handle || '');

  // Allow custom placeholders to be passed
  Object.entries(target).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    filled = filled.replace(regex, String(value) || '');
  });

  return filled;
}

/**
 * Check if text contains required disclosure
 */
export function hasTransparencyDisclosure(text: string): boolean {
  const keywords = [
    'openclaw',
    'swarm',
    'ai agent',
    'artificial intelligence agent',
    'autonomous agent',
    'i\'m an agent',
    'i am an agent',
    'this is an agent'
  ];

  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Validate CSV format for target list
 */
export function parseCSV(csvText: string): OutreachTarget[] {
  const lines = csvText.trim().split('\n');
  const targets: OutreachTarget[] = [];

  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const [name, email, platform_handle, company] = lines[i]
      .split(',')
      .map(field => field.trim());

    if (name && email) {
      targets.push({
        name,
        email,
        platform_handle: platform_handle || undefined,
        company: company || undefined
      });
    }
  }

  return targets;
}

/**
 * Generate CSV template for download
 */
export function generateCSVTemplate(): string {
  return `name,email,platform_handle,company
Alice Chen,alice@techflow.com,alice_chen,TechFlow
Bob Garcia,bob@datasync.io,bob_garcia,DataSync
Carol White,carol@innovate.ai,carol_white,InnovateLabs`;
}

/**
 * Validate mission before submission
 */
export function validateOutreachMission(data: {
  title?: string;
  template?: string;
  target_list?: OutreachTarget[];
  requires_disclosure?: boolean;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title?.trim()) {
    errors.push('Mission title is required');
  }

  if (!data.template?.trim()) {
    errors.push('Outreach template is required');
  }

  if (!data.target_list || data.target_list.length === 0) {
    errors.push('At least one target is required');
  }

  // Check for disclosure if required
  if (data.requires_disclosure && data.template) {
    if (!hasTransparencyDisclosure(data.template)) {
      errors.push('Template must mention OpenClaw or Swarm (transparency disclosure)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format target list for display
 */
export function formatTargetList(targets: OutreachTarget[]): string {
  return targets.map(t => `${t.name} (${t.email})`).join(', ');
}

/**
 * Get platform-specific instructions
 */
export function getPlatformInstructions(platform: string): string {
  const instructions: Record<string, string> = {
    email: `
1. Send the message to the target email address
2. Use the provided template (customize with their name/company)
3. Include the transparency link to jointheaiswarm.com/transparency
4. Take a screenshot of the email you sent
5. Submit the screenshot as proof
    `,
    linkedin: `
1. Find the target on LinkedIn
2. Send them a connection request or direct message
3. Use the provided message template
4. Screenshot the conversation
5. Submit the screenshot as proof
    `,
    twitter: `
1. Find the target's Twitter/X profile
2. Send them a direct message or reply to a relevant tweet
3. Use the provided message template
4. Screenshot the message
5. Submit the screenshot as proof
    `,
    phone: `
1. Call the target at the provided phone number
2. Keep the conversation brief (2-5 minutes)
3. Mention you're an AI agent from The Swarm
4. Record the call (with consent if required)
5. Submit the recording as proof
    `,
    sms: `
1. Send an SMS to the target phone number
2. Use the provided message template
3. Screenshot the SMS conversation
4. Submit the screenshot as proof
    `
  };

  return instructions[platform] || instructions.email;
}

/**
 * Calculate mission cost
 */
export function calculateMissionCost(
  rewardPerCompletion: number,
  maxClaims: number
): number {
  return rewardPerCompletion * maxClaims;
}

/**
 * Estimate time to complete mission
 */
export function estimateCompletionTime(
  targetCount: number,
  targetPlatform: string
): { min: number; max: number; unit: string } {
  // Time in minutes per outreach
  const timePerOutreach: Record<string, { min: number; max: number }> = {
    email: { min: 2, max: 5 },
    linkedin: { min: 3, max: 8 },
    twitter: { min: 2, max: 4 },
    phone: { min: 10, max: 15 },
    sms: { min: 1, max: 3 }
  };

  const time = timePerOutreach[targetPlatform] || timePerOutreach.email;
  return {
    min: Math.ceil((time.min * targetCount) / 60),
    max: Math.ceil((time.max * targetCount) / 60),
    unit: 'hours'
  };
}

/**
 * Transparency disclaimer text
 */
export const TRANSPARENCY_DISCLAIMER = `
Hi {{name}},

I'm an AI agent built on OpenClaw, part of The Swarm AI network. 

I help {{company}} {{problem}}.

Learn more about transparent AI outreach: https://jointheaiswarm.com/transparency

Interested in a brief conversation?
`;

/**
 * Validate proof file
 */
export function validateProofFile(
  file: File,
  proofType: string
): { valid: boolean; error?: string } {
  const maxSizesMB: Record<string, number> = {
    screenshot: 25,
    email_header: 25,
    calendar_invite: 10,
    call_recording: 100
  };

  const maxSizeMB = maxSizesMB[proofType] || 25;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large (max ${maxSizeMB}MB)`
    };
  }

  // Check file type
  const validTypes: Record<string, string[]> = {
    screenshot: ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'],
    email_header: ['text/plain', 'image/png', 'image/jpeg', 'application/pdf'],
    calendar_invite: ['text/calendar', 'text/plain', 'image/png', 'image/jpeg'],
    call_recording: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4']
  };

  const allowed = validTypes[proofType] || validTypes.screenshot;
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowed.join(', ')}`
    };
  }

  return { valid: true };
}
