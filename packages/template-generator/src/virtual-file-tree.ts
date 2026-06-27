export type VirtualFile = {
  path: string;
  contents: string | Uint8Array;
};

export type VirtualFileTree = readonly VirtualFile[];

export function sortVirtualFileTree(tree: VirtualFileTree): VirtualFileTree {
  return [...tree].sort((left, right) => left.path.localeCompare(right.path));
}

export function mergeVirtualFileTrees(...trees: VirtualFileTree[]): VirtualFileTree {
  const filesByPath = new Map<string, VirtualFile>();

  for (const tree of trees) {
    for (const file of tree) {
      if (filesByPath.has(file.path)) {
        throw new Error(
          `Generated Template layers emit duplicate path ${JSON.stringify(file.path)}. Move the file into one Template layer or add an explicit override boundary.`,
        );
      }

      filesByPath.set(file.path, file);
    }
  }

  return sortVirtualFileTree([...filesByPath.values()]);
}

export function getVirtualFile(tree: VirtualFileTree, path: string): VirtualFile | undefined {
  return tree.find((file) => file.path === path);
}
