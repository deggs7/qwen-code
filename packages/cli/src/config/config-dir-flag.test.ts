/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyConfigDirFromArgs,
  resolveConfigDirFromArgs,
  stripConfigDirFromArgs,
} from './config-dir-flag.js';

describe('--config-dir bootstrap', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'qwen-config-dir-')));
  });

  afterEach(() => {
    chmodSync(root, 0o700);
    rmSync(root, { recursive: true, force: true });
  });

  it('canonicalizes an existing absolute directory', () => {
    const profile = path.join(root, 'profile');
    mkdirSync(profile);

    expect(resolveConfigDirFromArgs(['--config-dir', profile])).toBe(
      realpathSync(profile),
    );
  });

  it('uses the last value and ignores positional data after --', () => {
    const first = path.join(root, 'first');
    const second = path.join(root, 'second');
    mkdirSync(first);
    mkdirSync(second);

    expect(
      resolveConfigDirFromArgs([
        '--config-dir',
        first,
        `--config-dir=${second}`,
        '--',
        '--config-dir',
        'ignored',
      ]),
    ).toBe(realpathSync(second));
  });

  it('fails closed for missing and relative values', () => {
    const env: NodeJS.ProcessEnv = { QWEN_HOME: '/existing' };

    expect(() => applyConfigDirFromArgs(['--config-dir'], env)).toThrow(
      '--config-dir requires a directory path.',
    );
    expect(() => applyConfigDirFromArgs(['--config-dir='], env)).toThrow(
      '--config-dir requires a directory path.',
    );
    expect(() =>
      applyConfigDirFromArgs(['--config-dir', 'relative/profile'], env),
    ).toThrow('--config-dir must be an absolute path.');
    expect(env['QWEN_HOME']).toBe('/existing');
  });

  it('fails closed for a missing path or a file', () => {
    const file = path.join(root, 'settings.json');
    writeFileSync(file, '{}');

    for (const value of [path.join(root, 'missing'), file]) {
      expect(() => resolveConfigDirFromArgs(['--config-dir', value])).toThrow(
        '--config-dir must be an existing, readable, and writable directory',
      );
    }
  });

  it.skipIf(process.platform === 'win32')(
    'fails closed for an unwritable directory',
    () => {
      chmodSync(root, 0o500);
      expect(() => resolveConfigDirFromArgs(['--config-dir', root])).toThrow(
        '--config-dir must be an existing, readable, and writable directory',
      );
    },
  );

  it('overrides an inherited QWEN_HOME after validation', () => {
    const env: NodeJS.ProcessEnv = { QWEN_HOME: '/existing' };

    expect(applyConfigDirFromArgs(['--config-dir', root], env)).toBe(root);
    expect(env['QWEN_HOME']).toBe(root);
  });

  it('strips consumed values without touching positional data after --', () => {
    expect(
      stripConfigDirFromArgs([
        'node',
        'cli.js',
        '--config-dir',
        'profiles/one',
        '--config-dir=profiles/two',
        '--model',
        'qwen',
        '--',
        '--config-dir',
        'prompt-data',
      ]),
    ).toEqual([
      'node',
      'cli.js',
      '--model',
      'qwen',
      '--',
      '--config-dir',
      'prompt-data',
    ]);
  });
});
