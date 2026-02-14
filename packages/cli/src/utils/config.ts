import * as path from 'path';
import * as os from 'os';

export function getConfigDir(): string {
  const home = os.homedir();
  return path.join(home, '.theswarm');
}

export function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}
