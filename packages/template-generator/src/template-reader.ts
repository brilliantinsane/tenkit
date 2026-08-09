import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import Handlebars from 'handlebars';
import isBinaryPath from 'is-binary-path';
import { join, relative, resolve } from 'pathe';
import { globSync } from 'tinyglobby';
import {
  type GeneratedAppVariantRole,
  type GeneratedSetupType,
} from '@tenkit/types/setup-type-definitions';
import { type GeneratedStylingChoice } from '@tenkit/types/styling-definitions';

import { type GeneratedAccentColor } from './generated-accent-color';
import { sortVirtualFileTree, type VirtualFileTree } from './virtual-file-tree';

export type TemplateContext = {
  appVariants: readonly TemplateAppVariantContext[];
  isExpressBackend: boolean;
  isSingleAppRuntimeTenants: boolean;
  isBareStyling: boolean;
  isBunPackageManager: boolean;
  isNpmPackageManager: boolean;
  isUnistylesStyling: boolean;
  isUniwindStyling: boolean;
  packageName: string;
  packageManager: GeneratedProjectPackageManager;
  packageManagerInstallCommand: string;
  packageManagerRunCommand: string;
  packageManagerServerRunCommand: string;
  packageManagerTenkitCommand: string;
  projectName: string;
  projectNameStringLiteral: string;
  stylingChoice: GeneratedStylingChoice;
  setupType: GeneratedSetupType;
};

export type TemplateAppVariantContext = {
  accent: GeneratedAccentColor;
  accentStringLiteral: string;
  appVariantId: number;
  bundleIdentifier: string;
  displayName: string;
  displayNameStringLiteral: string;
  packageName: string;
  role: GeneratedAppVariantRole;
  scheme: string;
  slug: string;
};

export const GENERATED_PROJECT_PACKAGE_MANAGERS = ['pnpm', 'npm', 'bun'] as const;

export type GeneratedProjectPackageManager = (typeof GENERATED_PROJECT_PACKAGE_MANAGERS)[number];

const templatesRoot = resolve(fileURLToPath(new URL('../templates', import.meta.url)));
const handlebars = Handlebars.create();

handlebars.registerHelper(
  'ifSetupType',
  function (
    this: TemplateContext,
    expectedSetupType: GeneratedSetupType,
    options: Handlebars.HelperOptions,
  ) {
    return this.setupType === expectedSetupType ? options.fn(this) : options.inverse(this);
  },
);

function toVirtualPath(path: string): string {
  return path.split('\\').join('/');
}

function toOutputPath(path: string): string {
  const emittedPath = path.endsWith('.hbs') ? path.slice(0, -'.hbs'.length) : path;

  return emittedPath
    .split('/')
    .map((segment) => {
      if (segment === '_gitignore') return '.gitignore';
      if (segment === '_claude') return '.claude';
      if (segment === '_vscode') return '.vscode';
      return segment;
    })
    .join('/');
}

function renderTemplateContent(contents: string, context: TemplateContext): string {
  return handlebars.compile(contents, { noEscape: true })(context);
}

function isTextTemplateFile(path: string): boolean {
  return !isBinaryPath(path);
}

function isIgnoredTemplateArtifact(path: string): boolean {
  return path.split('/').includes('.DS_Store');
}

export function readTemplateTree(templatePath: string, context: TemplateContext): VirtualFileTree {
  const templateRoot = resolve(templatesRoot, templatePath);

  if (!fs.pathExistsSync(templateRoot)) {
    throw new Error(`Template directory not found: ${templatePath}`);
  }

  const files = globSync('**/*', { cwd: templateRoot, dot: true, onlyFiles: true })
    .filter((file) => !isIgnoredTemplateArtifact(toVirtualPath(file)))
    .map((file) => join(templateRoot, file));

  return sortVirtualFileTree(
    files.map((file) => {
      const templatePath = toVirtualPath(relative(templateRoot, file));
      const path = toOutputPath(templatePath);
      const contents = templatePath.endsWith('.hbs')
        ? renderTemplateContent(fs.readFileSync(file, 'utf8'), context)
        : isTextTemplateFile(templatePath)
          ? fs.readFileSync(file, 'utf8')
          : fs.readFileSync(file);

      return { path, contents };
    }),
  );
}
