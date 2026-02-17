import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('[v0] Regenerating package-lock.json...');
try {
  execSync('npm install --package-lock-only', { cwd: rootDir, stdio: 'inherit' });
  console.log('[v0] Root package-lock.json regenerated successfully.');
} catch (err) {
  console.error('[v0] Failed to regenerate root lock file:', err.message);
}
