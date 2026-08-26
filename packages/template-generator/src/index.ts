export {
  formatSupportedGeneratedSetupTypes,
  generateGenericWithStandaloneAppVariantsProject,
  generateProject,
  generateSingleAppRuntimeTenantsProject,
  generateWhiteLabelAppsProject,
  normalizeGeneratedAccentColor,
  normalizeGeneratedSetupType,
  type GenerateProjectConfig,
  type GeneratedAccentColor,
  type GeneratedProjectPackageManager,
  type GenericWithStandaloneAppVariantsProjectConfig,
  type SingleAppRuntimeTenantsProjectConfig,
  type WhiteLabelAppsProjectConfig,
} from './generator';
export { type VirtualFile, type VirtualFileTree } from './virtual-file-tree';
export {
  preflightWriteProject,
  writeProject,
  type WriteProjectOptions,
  type WriteProjectOverwriteMode,
  type WriteProjectResult,
} from './writer';
