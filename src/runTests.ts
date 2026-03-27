import { readdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

function getTestFiles(rootPath: string): string[] {
  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(entryPath);
    }
  }

  return files;
}

function run(): void {
  const testFiles = getTestFiles(__dirname).sort();

  for (const testFile of testFiles) {
    const result = spawnSync(process.execPath, [ testFile ], { stdio: 'inherit' });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

run();