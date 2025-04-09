/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let _isSea = false;

// Attempt to dynamically import 'node:sea' (available in Node 20.10+)
try {
  const sea = await import('node:sea');
  if (typeof sea.isSea === 'function') {
    _isSea = sea.isSea();
  }
} catch {
  // SEA not supported — assume regular mode
  _isSea = false;
}

const getDirname = () => {
  return _isSea ? process.cwd() : dirname(fileURLToPath(import.meta.url));
};

export const rootDir = getDirname();
export const jdkPath = join(rootDir, 'jdk');
export const jarPath = join(rootDir, 'yafva.jar');
