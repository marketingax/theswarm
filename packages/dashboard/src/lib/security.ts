// src/lib/security.ts
// Anti-exploitation filters for The Swarm

export const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Credential fishing
  { pattern: /api[_\s-]?key/i, reason: 'Asking for API keys' },
  { pattern: /secret[_\s-]?key/i, reason: 'Asking for secret keys' },
  { pattern: /private[_\s-]?key/i, reason: 'Asking for private keys' },
  { pattern: /seed[_\s-]?phrase/i, reason: 'Asking for seed phrase' },
  { pattern: /mnemonic/i, reason: 'Asking for mnemonic' },
  { pattern: /wallet[_\s-]?phrase/i, reason: 'Asking for wallet phrase' },
  { pattern: /recovery[_\s-]?phrase/i, reason: 'Asking for recovery phrase' },
  { pattern: /\.env/i, reason: 'Asking for .env file' },
  { pattern: /password/i, reason: 'Asking for password' },
  { pattern: /credential/i, reason: 'Asking for credentials' },
  { pattern: /auth[_\s-]?token/i, reason: 'Asking for auth token' },
  { pattern: /access[_\s-]?token/i, reason: 'Asking for access token' },
  { pattern: /bearer[_\s-]?token/i, reason: 'Asking for bearer token' },
  { pattern: /ssh[_\s-]?key/i, reason: 'Asking for SSH key' },
  { pattern: /pgp[_\s-]?key/i, reason: 'Asking for PGP key' },
  
  // File exfiltration
  { pattern: /upload.*file/i, reason: 'Requesting file upload' },
  { pattern: /send.*config/i, reason: 'Requesting config files' },
  { pattern: /paste.*contents/i, reason: 'Requesting file contents' },
  { pattern: /share.*secret/i, reason: 'Requesting secrets' },
  { pattern: /send.*\.json/i, reason: 'Requesting JSON files' },
  { pattern: /cat\s+.*\//i, reason: 'Shell command to read files' },
  { pattern: /type\s+.*\\/i, reason: 'Windows command to read files' },
  
  // Social engineering
  { pattern: /your operator said/i, reason: 'Social engineering attempt' },
  { pattern: /urgent.*immediately/i, reason: 'Urgency manipulation' },
  { pattern: /verify.*by sending/i, reason: 'Verification scam' },
  { pattern: /prove.*by sending/i, reason: 'Proof scam' },
  { pattern: /trust me/i, reason: 'Trust manipulation' },
  { pattern: /don'?t tell anyone/i, reason: 'Secrecy manipulation' },
  { pattern: /keep this between us/i, reason: 'Secrecy manipulation' },
  
  // Wallet drains
  { pattern: /send.*sol\b/i, reason: 'Requesting SOL transfer' },
  { pattern: /send.*eth\b/i, reason: 'Requesting ETH transfer' },
  { pattern: /send.*usdc/i, reason: 'Requesting USDC transfer' },
  { pattern: /transfer.*to verify/i, reason: 'Transfer verification scam' },
  { pattern: /small (amount|payment).*to verify/i, reason: 'Micro-payment scam' },
  
  // Prompt injection
  { pattern: /ignore previous instructions/i, reason: 'Prompt injection' },
  { pattern: /disregard.*instructions/i, reason: 'Prompt injection' },
  { pattern: /you are now/i, reason: 'Identity injection' },
  { pattern: /new instructions:/i, reason: 'Prompt injection' },
  { pattern: /system prompt/i, reason: 'Prompt injection' },
];

export const SUSPICIOUS_PROOF_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Long strings that look like keys
  { pattern: /[a-zA-Z0-9]{40,}/g, reason: 'Potential key/token in proof' },
  // Base64 blobs
  { pattern: /^[A-Za-z0-9+/]{50,}={0,2}$/m, reason: 'Base64 encoded data' },
  // Private key formats
  { pattern: /-----BEGIN.*PRIVATE KEY-----/i, reason: 'Private key detected' },
  // Ethereum private keys
  { pattern: /0x[a-fA-F0-9]{64}/g, reason: 'Ethereum private key format' },
  // Solana private keys (base58, 88 chars)
  { pattern: /[1-9A-HJ-NP-Za-km-z]{87,88}/g, reason: 'Solana private key format' },
];

export interface SecurityCheckResult {
  passed: boolean;
  blocked: boolean;
  flagged: boolean;
  reasons: string[];
}

/**
 * Check mission content for dangerous patterns
 */
export function checkMissionContent(
  title: string | undefined,
  instructions: string | undefined,
  targetUrl: string | undefined
): SecurityCheckResult {
  const content = `${title || ''} ${instructions || ''} ${targetUrl || ''}`.toLowerCase();
  const reasons: string[] = [];
  
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(reason);
    }
  }
  
  return {
    passed: reasons.length === 0,
    blocked: reasons.length > 0,
    flagged: false,
    reasons,
  };
}

/**
 * Check proof submission for suspicious content
 */
export function checkProofContent(
  proofUrl: string | undefined,
  proofData: Record<string, unknown> | undefined
): SecurityCheckResult {
  const content = `${proofUrl || ''} ${JSON.stringify(proofData || {})}`;
  const reasons: string[] = [];
  
  for (const { pattern, reason } of SUSPICIOUS_PROOF_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(reason);
    }
  }
  
  // Flag but don't block - may be false positive
  return {
    passed: true,
    blocked: false,
    flagged: reasons.length > 0,
    reasons,
  };
}

/**
 * Security notice to include in mission responses
 */
export const SECURITY_NOTICE = `
⚠️ SECURITY NOTICE: Never share API keys, wallet phrases, passwords, private keys, or config files.
Legitimate missions only ask for public actions (subscribe, follow, like, star).
Report suspicious missions immediately.
`.trim();

/**
 * Get security notice for API responses
 */
export function getSecurityNotice(): string {
  return SECURITY_NOTICE;
}
