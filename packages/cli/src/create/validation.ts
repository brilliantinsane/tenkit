import {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedSetupType,
  type GeneratedSetupType,
} from '@tenkit/template-generator';

import { DEFAULT_PUBLIC_SETUP_SLUG } from '../constants';
import type { PublicCliGitMode } from './types';

function isPathSeparatorPresent(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

export function validateProjectName(value: string): string {
  const projectName = value.trim();

  if (projectName.length === 0) {
    throw new Error('Project name is required.');
  }

  if (projectName === '.' || projectName === '..') {
    throw new Error('Project name must be a child folder name.');
  }

  if (isPathSeparatorPresent(projectName)) {
    throw new Error('Project name must not contain path separators.');
  }

  if (/[\0-\x1F<>:"|?*]/.test(projectName)) {
    throw new Error('Project name contains characters that are unsafe for a project folder.');
  }

  return projectName;
}

function slugifyPackageName(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function validatePackageName(value: string): string {
  const packageName = value.trim();

  if (packageName.length === 0) {
    throw new Error('Package name is required.');
  }

  if (packageName.length > 214) {
    throw new Error('Package name must be 214 characters or fewer.');
  }

  if (packageName !== packageName.toLowerCase()) {
    throw new Error('Package name must be lowercase.');
  }

  if (isPathSeparatorPresent(packageName)) {
    throw new Error('Package name must not contain path separators.');
  }

  if (packageName.startsWith('.') || packageName.startsWith('_')) {
    throw new Error('Package name must not start with "." or "_".');
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(packageName)) {
    throw new Error(
      'Package name must contain only lowercase letters, numbers, ".", "_", and "-".',
    );
  }

  return packageName;
}

export function derivePackageName(projectName: string): string {
  const packageName = slugifyPackageName(projectName);

  return validatePackageName(packageName);
}

export function normalizeSetupInput(
  setup: string | undefined,
  setupType: string | undefined,
): GeneratedSetupType {
  if (setup !== undefined && setupType !== undefined && setup !== setupType) {
    throw new Error('Use either --setup or --setup-type, not both with different values.');
  }

  const selectedSetup = setup ?? setupType ?? DEFAULT_PUBLIC_SETUP_SLUG;

  try {
    return normalizeGeneratedSetupType(selectedSetup);
  } catch {
    throw new Error(
      `Unsupported Setup Type ${JSON.stringify(selectedSetup)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
    );
  }
}

export function parseGitMode(value: unknown): PublicCliGitMode | undefined {
  if (value === false) {
    return false;
  }

  if (value === undefined) {
    return undefined;
  }

  if (value === 'init' || value === 'commit' || value === 'none') {
    return value;
  }

  throw new Error('Git mode must be one of: init, commit, none.');
}
