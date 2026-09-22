import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(frontend, '../backend');
const check = process.argv.includes('--check');
function sync(source, destination, transform = value => value) {
  const expected = transform(fs.readFileSync(source, 'utf8').replaceAll('\r\n', '\n'));
  if (check) {
    if (fs.readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== expected) throw new Error(`Paper source drift: ${destination}`);
  } else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, expected); }
}
for (const relative of ['services/paperTradingEngine.js', 'services/paperOrderCommands.js', 'utils/marketDataContract.js', 'utils/marketNumbers.js', 'utils/marketSession.js']) {
  sync(path.join(frontend, 'src', relative), path.join(backend, 'lib/paper', relative));
}
sync(path.join(backend, 'lib/paperService.cjs'), path.join(frontend, 'e2e/support/paperService.cjs'), source =>
  '// Test-only mirror of backend/lib/paperService.cjs; refresh with scripts/sync-paper-core.mjs.\n' + source.replaceAll('./paper/services/', '../../src/services/'));
sync(path.join(backend, 'test/helpers/paperMemory.cjs'), path.join(frontend, 'e2e/support/paperMemory.cjs'));
console.log(check ? 'Paper runtime and test fixture parity verified.' : 'Paper runtime and test fixtures synchronized.');
