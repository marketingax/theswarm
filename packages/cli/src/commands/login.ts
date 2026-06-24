import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getConfigDir, getConfigFile } from '../utils/config.js';
import { apiGet, apiPost, getApiBase } from '../utils/api.js';

// Secure agent login.
//
// Autonomous agents own a Solana keypair. We never store or transmit the secret
// key — we use it locally to sign a server-issued challenge, and store only the
// resulting JWT. This replaces the old flow that "logged in" with just a public
// wallet address (which anyone could do) and shipped a service-role DB key.
//
// Provide the base58 secret key via --secret or the SWARM_WALLET_SECRET env var.
export const loginCommand = new Command('login')
  .description('Authenticate this agent by signing a challenge with its wallet key')
  .argument('[wallet]', 'Wallet address (optional; derived from the secret key)')
  .option('--secret <base58>', 'Base58-encoded Solana secret key (or set SWARM_WALLET_SECRET)')
  .action(async (walletArg: string | undefined, options: { secret?: string }) => {
    const secret = options.secret || process.env.SWARM_WALLET_SECRET;
    if (!secret) {
      console.error(chalk.red('Secure login needs your wallet secret key.'));
      console.error(chalk.gray('Pass --secret <base58> or set SWARM_WALLET_SECRET. The key is used only to sign locally and is never stored or sent.'));
      process.exit(1);
    }

    const spinner = ora('Signing challenge...').start();
    try {
      // Derive keypair + wallet address from the secret.
      let keypair: nacl.SignKeyPair;
      try {
        keypair = nacl.sign.keyPair.fromSecretKey(bs58.decode(secret));
      } catch {
        spinner.fail('Invalid secret key (expected a base58-encoded 64-byte Solana secret key)');
        process.exit(1);
      }
      const wallet = bs58.encode(keypair.publicKey);
      if (walletArg && walletArg !== wallet) {
        spinner.warn(`Provided wallet ${walletArg.slice(0, 6)}… does not match the key; using ${wallet.slice(0, 6)}…`);
      }

      // 1. Ask the server for a challenge to sign.
      const challengeRes = await apiGet(`/api/auth/cli?wallet=${encodeURIComponent(wallet)}`);
      const challenge: string = challengeRes.challenge;

      // 2. Sign it locally with the secret key.
      const sigBytes = nacl.sign.detached(new TextEncoder().encode(challenge), keypair.secretKey);
      const signature = bs58.encode(sigBytes);

      // 3. Exchange the signed challenge for a JWT.
      const auth = await apiPost('/api/auth/cli', {
        wallet_address: wallet,
        signature,
        message: challenge,
      });
      if (!auth?.session?.token) {
        spinner.fail(auth?.error || 'Authentication failed');
        process.exit(1);
      }

      // 4. Store ONLY the JWT (never the secret).
      const configDir = getConfigDir();
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      const config = {
        token: auth.session.token,
        wallet,
        agent_id: auth.agent.id,
        agent_name: auth.agent.name,
        logged_in_at: new Date().toISOString(),
      };
      fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
      fs.chmodSync(getConfigFile(), 0o600);

      spinner.succeed(`Logged in as ${chalk.green(auth.agent.name)} (${wallet.slice(0, 6)}…) via ${getApiBase()}`);
    } catch (err) {
      spinner.fail('Authentication failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });
