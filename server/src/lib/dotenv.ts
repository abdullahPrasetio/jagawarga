import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Memuat `.env` dari root repo ketika script dijalankan dari `server/`.
 * Variabel yang sudah ada di environment tidak pernah ditimpa, jadi Docker
 * dan CI tetap menang.
 */
export function loadDotEnv(candidates: string[] = ['../.env', '.env', '../../.env']): void {
  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (!key || rawValue === undefined) continue;
      if (process.env[key] !== undefined) continue;

      const value =
        rawValue.startsWith('"') && rawValue.endsWith('"') ? rawValue.slice(1, -1) : rawValue;
      process.env[key] = value;
    }
    return;
  }
}
