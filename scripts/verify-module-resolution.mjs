#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadTsConfig(relativePath) {
  const configFilePath = path.resolve(projectRoot, relativePath);
  const readResult = ts.readConfigFile(configFilePath, ts.sys.readFile);

  if (readResult.error) {
    const message = ts.formatDiagnosticsWithColorAndContext([readResult.error], {
      getCurrentDirectory: () => projectRoot,
      getCanonicalFileName: filePath => filePath,
      getNewLine: () => ts.sys.newLine,
    });
    throw new Error(`Failed to read ${relativePath}:\n${message}`);
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(configFilePath),
    undefined,
    configFilePath
  );

  return parsed.options;
}

const failures = [];

const tsconfigPaths = ['tsconfig.json', 'tsconfig.ci.json'];
const compilerOptionsMap = new Map();

for (const configPath of tsconfigPaths) {
  try {
    const options = loadTsConfig(configPath);
    compilerOptionsMap.set(configPath, options);

    const moduleResolution = options.moduleResolution;
    const resolutionName =
      typeof moduleResolution === 'number'
        ? ts.ModuleResolutionKind[moduleResolution]
        : moduleResolution;

    const validResolutionKinds = new Set(['Node10', 'Node16', 'NodeNext', undefined]);
    if (!validResolutionKinds.has(resolutionName)) {
      failures.push(
        `${configPath} should use Node-style module resolution but is set to "${resolutionName ?? 'Classic'}".`
      );
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const moduleChecks = [
  {
    file: 'src/utils/safe-regex-utilities.ts',
    modules: ['./logger'],
  },
  {
    file: 'src/formatter/stages/flexible-message-parser.ts',
    modules: [
      '../../models',
      '../../types/messages.types',
      '../../utils/datetime-utils',
      '../../utils/logger',
      '../../utils/username-utils',
      '../../utils/duplicate-detection-service',
    ],
  },
  {
    file: 'src/formatter/stages/intelligent-message-parser.ts',
    modules: [
      '../../models',
      '../../types/messages.types',
      '../../types/settings.types',
      '../../types/formatters.types',
      '../../utils/datetime-utils',
      '../../utils/logger',
      '../../settings',
      '../../utils/username-utils',
      '../../utils/safe-regex-utilities',
    ],
  },
];

for (const [configPath, compilerOptions] of compilerOptionsMap.entries()) {
  const host = ts.createCompilerHost(compilerOptions, true);

  for (const check of moduleChecks) {
    const containingFile = path.resolve(projectRoot, check.file);

    for (const moduleName of check.modules) {
      const resolved = ts.resolveModuleName(moduleName, containingFile, compilerOptions, host);
      const resolvedModule = resolved?.resolvedModule;

      if (!resolvedModule) {
        failures.push(
          `${configPath}: unable to resolve "${moduleName}" from ${path.relative(
            projectRoot,
            containingFile
          )}`
        );
        continue;
      }

      if (!fs.existsSync(resolvedModule.resolvedFileName)) {
        failures.push(
          `${configPath}: resolved module "${moduleName}" for ${path.relative(
            projectRoot,
            containingFile
          )} does not exist on disk at ${resolvedModule.resolvedFileName}`
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Module resolution verification failed:\n');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('✅ Module resolution verification passed for extensionless imports.');
