import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import Handlebars from 'handlebars';
import isBinaryPath from 'is-binary-path';
import { join, relative, resolve } from 'pathe';
import { globSync } from 'tinyglobby';

import { type GeneratedStylingChoice } from './generated-styling-choices';
import { sortVirtualFileTree, type VirtualFileTree } from './virtual-file-tree';

export type TemplateContext = {
  isSingleAppRuntimeTenants: boolean;
  isBareStyling: boolean;
  isBunPackageManager: boolean;
  isNpmPackageManager: boolean;
  isPnpmPackageManager: boolean;
  isUniwindStyling: boolean;
  packageName: string;
  packageManager: GeneratedProjectPackageManager;
  packageManagerInstallCommand: string;
  packageManagerRunCommand: string;
  packageManagerTenkitCommand: string;
  projectName: string;
  projectNameStringLiteral: string;
  stylingChoice: GeneratedStylingChoice;
};

export const GENERATED_PROJECT_PACKAGE_MANAGERS = ['pnpm', 'npm', 'bun'] as const;

export type GeneratedProjectPackageManager = (typeof GENERATED_PROJECT_PACKAGE_MANAGERS)[number];

const templatesRoot = resolve(fileURLToPath(new URL('../templates', import.meta.url)));
const handlebars = Handlebars.create();

function toVirtualPath(path: string): string {
  return path.split('\\').join('/');
}

function toOutputPath(path: string): string {
  const mappedPath = path
    .split('/')
    .map((segment) => {
      if (segment === '_gitignore') return '.gitignore';
      if (segment === '_claude') return '.claude';
      if (segment === '_vscode') return '.vscode';
      return segment;
    })
    .join('/');

  return mappedPath.endsWith('.hbs') ? mappedPath.slice(0, -'.hbs'.length) : mappedPath;
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

function shouldIncludeTemplateFile(path: string, context: TemplateContext): boolean {
  if (toOutputPath(path) === 'pnpm-workspace.yaml') {
    return context.isPnpmPackageManager;
  }

  return true;
}

export function readTemplateTree(templatePath: string, context: TemplateContext): VirtualFileTree {
  const templateRoot = resolve(templatesRoot, templatePath);

  if (!fs.pathExistsSync(templateRoot)) {
    throw new Error(`Template directory not found: ${templatePath}`);
  }

  const files = globSync('**/*', { cwd: templateRoot, dot: true, onlyFiles: true })
    .filter((file) => !isIgnoredTemplateArtifact(toVirtualPath(file)))
    .filter((file) => shouldIncludeTemplateFile(toVirtualPath(file), context))
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
