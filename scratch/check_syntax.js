import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.gemini' || file === 'scratch') {
      continue;
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js')) {
      try {
        execSync(`node -c "${fullPath}"`, { stdio: 'ignore' });
      } catch (err) {
        console.log(`❌ Syntax error in file: ${fullPath}`);
      }
    }
  }
}

console.log("🔍 Scanning project files for syntax errors...");
walk('.');
console.log("Done scanning.");
