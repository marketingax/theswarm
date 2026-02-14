import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getConfigFile } from './config.js';

export interface AuthConfig {
  token: string;
  wallet: string;
  agent_id: string;
  agent_name: string;
  logged_in_at: string;
}

export function getAuth(): AuthConfig | null {
  try {
    const configFile = getConfigFile();
    if (!fs.existsSync(configFile)) {
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return config as AuthConfig;
  } catch {
    return null;
  }
}

export function requireAuth(): AuthConfig {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Not authenticated. Run: theswarm login <wallet>');
  }
  return auth;
}
