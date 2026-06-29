export {
  generateGenericWithStandaloneAppVariantsProject,
  generateProject,
  generateSingleAppRuntimeTenantsProject,
  generateWhiteLabelAppsProject,
  SUPPORTED_GENERATED_SETUP_TYPES,
  type GenerateProjectConfig,
  type GenericWithStandaloneAppVariantsProjectConfig,
  type GeneratedSetupType,
  type SingleAppRuntimeTenantsProjectConfig,
  type WhiteLabelAppsProjectConfig,
} from './generator';
export { readTemplateTree, type TemplateContext } from './template-reader';
export {
  getVirtualFile,
  mergeVirtualFileTrees,
  sortVirtualFileTree,
  type VirtualFile,
  type VirtualFileTree,
} from './virtual-file-tree';
export {
  validateVirtualFilePath,
  writeProject,
  type WriteProjectOptions,
  type WriteProjectOverwriteMode,
  type WriteProjectResult,
} from './writer';
