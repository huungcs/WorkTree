const { readFileSync, readdirSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

const projectRoot = join(__dirname, '..');
const sourceRoot = join(projectRoot, 'src');
const failures = [];

// Temporary debt baseline. Remove entries one by one as tenant context is injected.
const allowedFeatureToAppStateImports = new Set([
  'src/features/attachments/services/attachment-service.js',
  'src/features/checklists/services/checklist-service.js',
  'src/features/comments/services/comment-service.js',
  'src/features/dependencies/services/dependency-service.js',
  'src/features/organization-tree/services/tree-service.js',
  'src/features/tasks/services/task-service.js',
  'src/features/time-tracking/services/time-entry-service.js'
]);

function normalizePath(filePath) {
  return relative(projectRoot, filePath).split(sep).join('/');
}

function collectFiles(directory, predicate, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(filePath, predicate, output);
    } else if (entry.isFile() && predicate(filePath)) {
      output.push(filePath);
    }
  }
  return output;
}

function report(file, message) {
  failures.push(`${normalizePath(file)}: ${message}`);
}

const javascriptFiles = collectFiles(sourceRoot, file => file.endsWith('.js'));

for (const file of javascriptFiles) {
  const source = readFileSync(file, 'utf8');
  const normalizedFile = normalizePath(file);
  const importSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g)]
    .map(match => match[1]);

  if (normalizedFile.startsWith('src/components/ui/')) {
    for (const specifier of importSpecifiers) {
      if (specifier.includes('/features/') || specifier.includes('/lib/supabase')) {
        report(file, `generic UI must not import domain or Supabase module: ${specifier}`);
      }
    }
  }

  if (normalizedFile.startsWith('src/features/')) {
    const importsAppState = importSpecifiers.some(specifier => /(?:^|\/)app\/state\.js$/.test(specifier));
    if (importsAppState && !allowedFeatureToAppStateImports.has(normalizedFile)) {
      report(file, 'new feature-to-app state dependency is forbidden; inject organization context instead');
    }
  }
}

for (const allowedFile of allowedFeatureToAppStateImports) {
  const absoluteFile = join(projectRoot, ...allowedFile.split('/'));
  const source = readFileSync(absoluteFile, 'utf8');
  if (!/(?:^|\/)app\/state\.js['\"]/.test(source)) {
    report(absoluteFile, 'remove this resolved dependency from allowedFeatureToAppStateImports');
  }
}

const browserFiles = [
  ...collectFiles(join(projectRoot, 'src'), file => file.endsWith('.js')),
  ...collectFiles(join(projectRoot, 'js'), file => file.endsWith('.js')),
  join(projectRoot, 'index.html')
];

for (const file of browserFiles) {
  const source = readFileSync(file, 'utf8');
  const secretPatterns = [
    ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]+/],
    ['service-role environment variable', /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/],
    ['publicly exposed secret environment variable', /NEXT_PUBLIC_[A-Z0-9_]*SECRET\s*[:=]/]
  ];

  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(source)) {
      report(file, `${label} must not exist in browser-delivered source`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Architecture check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Architecture check passed. Protected ${javascriptFiles.length} source file(s); ` +
  `${allowedFeatureToAppStateImports.size} legacy feature-to-state import(s) remain baselined.`
);
