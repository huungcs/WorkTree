const { readdirSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = join(__dirname, '..');
const sourceRoots = ['js', 'src'];
const javascriptFiles = [];

function collectJavascriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      collectJavascriptFiles(absolutePath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      javascriptFiles.push(absolutePath);
    }
  }
}

for (const sourceRoot of sourceRoots) {
  collectJavascriptFiles(join(projectRoot, sourceRoot));
}

const failures = [];

for (const filePath of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--max-old-space-size=64', '--check', filePath], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures.push({
      file: relative(projectRoot, filePath),
      output: `${result.stdout || ''}${result.stderr || ''}`.trim()
    });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n${failure.file}\n${failure.output}`);
  }
  console.error(`\nSyntax check failed for ${failures.length} file(s).`);
  process.exit(1);
}

console.log(`Syntax check passed for ${javascriptFiles.length} JavaScript file(s).`);
