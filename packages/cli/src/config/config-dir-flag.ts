/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const CONFIG_DIR_FLAG = '--config-dir';

export class ConfigDirError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConfigDirError';
  }
}

export function resolveConfigDirFromArgs(
  argv: readonly string[],
): string | undefined {
  let selected: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') break;

    if (arg === CONFIG_DIR_FLAG) {
      const value = argv[i + 1];
      if (
        value === undefined ||
        value === '' ||
        value === '--' ||
        value.startsWith('-')
      ) {
        throw new ConfigDirError('--config-dir requires a directory path.');
      }
      selected = value;
      i++;
      continue;
    }

    if (arg.startsWith(`${CONFIG_DIR_FLAG}=`)) {
      const value = arg.slice(CONFIG_DIR_FLAG.length + 1);
      if (value === '') {
        throw new ConfigDirError('--config-dir requires a directory path.');
      }
      selected = value;
    }
  }

  if (selected === undefined) return undefined;
  if (!path.isAbsolute(selected)) {
    throw new ConfigDirError('--config-dir must be an absolute path.');
  }

  try {
    const canonical = realpathSync(selected);
    if (!statSync(canonical).isDirectory()) throw new Error('Not a directory');
    accessSync(canonical, constants.R_OK | constants.W_OK | constants.X_OK);
    return canonical;
  } catch (error) {
    throw new ConfigDirError(
      `--config-dir must be an existing, readable, and writable directory: ${selected}`,
      { cause: error },
    );
  }
}

export function applyConfigDirFromArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const selected = resolveConfigDirFromArgs(argv);
  if (selected !== undefined) env['QWEN_HOME'] = selected;
  return selected;
}

export function stripConfigDirFromArgs(argv: readonly string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') {
      result.push(...argv.slice(i));
      break;
    }
    if (arg === CONFIG_DIR_FLAG) {
      const value = argv[i + 1];
      if (value !== undefined && value !== '--' && !value.startsWith('-')) i++;
      continue;
    }
    if (arg.startsWith(`${CONFIG_DIR_FLAG}=`)) continue;
    result.push(arg);
  }

  return result;
}
