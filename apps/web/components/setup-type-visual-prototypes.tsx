"use client"

import {
  BracesIcon,
  FileCode2Icon,
  FileTextIcon,
  ImageIcon,
  Settings2Icon,
} from "lucide-react"

import type { SetupTypeStoryId } from "@/components/setup-type-stories-section"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  createFileIcons,
  createTreeCollection,
  TreeView,
  TreeViewBranch,
  TreeViewBranchContent,
  TreeViewBranchItem,
  TreeViewContent,
  TreeViewItem,
  TreeViewLabel,
  TreeViewNode,
  TreeViewTree,
} from "@/components/ui/tree-view"

type GeneratedProjectNode = {
  id: string
  name: string
  children?: GeneratedProjectNode[]
}

type GeneratedProject = {
  name: string
  summary: string
  paths: readonly string[]
  defaultExpandedValue: readonly string[]
}

const commonGeneratedPaths = [
  ".claude/settings.json",
  ".env.example",
  ".gitignore",
  ".vscode/extensions.json",
  ".vscode/settings.json",
  "AGENTS.md",
  "app.config.ts",
  "assets/_global/README.md",
  "CLAUDE.md",
  "eas.json",
  "package.json",
  "pnpm-workspace.yaml",
  "README.md",
  "scripts/tenkit-cli-core.ts",
  "scripts/tenkit-cli-runtime.ts",
  "scripts/tenkit-cli.ts",
  "src/app/_layout.tsx",
  "src/app/index.tsx",
  "src/components/app-tabs.tsx",
  "src/components/app-tabs.web.tsx",
  "src/components/themed-text.tsx",
  "src/components/themed-view.tsx",
  "src/constants/design-tokens.ts",
  "src/constants/globals.ts",
  "src/constants/project-config.ts",
  "src/hooks/use-app-variant-config.ts",
  "src/lib/resolve-app-variant-config.ts",
  "src/theme/colors.ts",
  "src/theme/config.ts",
  "src/theme/ThemeContext.tsx",
  "src/types/app-variant.ts",
  "tsconfig.json",
] as const

function appVariantAssetPaths(slug: string) {
  return [
    `assets/${slug}/app.icon/Assets/final-tenkit-logo.svg`,
    `assets/${slug}/app.icon/icon.json`,
    `assets/${slug}/icons/android-icon-background.png`,
    `assets/${slug}/icons/android-icon-foreground.png`,
    `assets/${slug}/icons/android-icon-monochrome.png`,
    `assets/${slug}/icons/favicon.png`,
    `assets/${slug}/icons/icon.png`,
    `assets/${slug}/icons/splash-icon-dark.png`,
    `assets/${slug}/icons/splash-icon-light.png`,
  ]
}

const generatedProjects = {
  "white-label": {
    name: "tenkit-white-label-app",
    summary: "2 App Variants",
    paths: [
      ...commonGeneratedPaths,
      ...appVariantAssetPaths("first-tenant"),
      ...appVariantAssetPaths("second-tenant"),
      "src/app/explore.tsx",
      "src/constants/app-variants.ts",
    ].sort(),
    defaultExpandedValue: ["assets", "src", "src/constants"],
  },
  "runtime-tenants": {
    name: "tenkit-runtime-tenants",
    summary: "1 App Variant + Runtime Tenant access",
    paths: [
      ...commonGeneratedPaths,
      ...appVariantAssetPaths("acme-app"),
      "src/app/settings.tsx",
      "src/constants/app-variant.ts",
      "src/constants/runtime-tenants.ts",
      "src/hooks/use-active-runtime-tenant.ts",
      "src/lib/runtime-tenant-access.ts",
      "src/storage/app-preferences.ts",
      "src/types/runtime-tenant.ts",
    ].sort(),
    defaultExpandedValue: ["assets", "src", "src/constants"],
  },
  hybrid: {
    name: "tenkit-generic-standalone",
    summary: "2 App Variants + Runtime Tenant access",
    paths: [
      ...commonGeneratedPaths,
      ...appVariantAssetPaths("atlas-network"),
      ...appVariantAssetPaths("west-studio"),
      "src/app/settings.tsx",
      "src/constants/app-variants.ts",
      "src/constants/runtime-tenants.ts",
      "src/hooks/use-active-runtime-tenant.ts",
      "src/lib/runtime-tenant-access.ts",
      "src/storage/app-preferences.ts",
      "src/types/runtime-tenant.ts",
    ].sort(),
    defaultExpandedValue: ["assets", "src", "src/constants"],
  },
} satisfies Record<SetupTypeStoryId, GeneratedProject>

const fileIcons = createFileIcons({
  ".example": Settings2Icon,
  ".json": BracesIcon,
  ".md": FileTextIcon,
  ".png": ImageIcon,
  ".svg": ImageIcon,
  ".ts": FileCode2Icon,
  ".tsx": FileCode2Icon,
})

function createProjectRoot(project: GeneratedProject): GeneratedProjectNode {
  const root: GeneratedProjectNode = {
    id: project.name,
    name: project.name,
    children: [],
  }

  for (const path of project.paths) {
    const segments = path.split("/")
    let currentChildren: GeneratedProjectNode[] = root.children ?? []
    let currentPath = ""

    for (const [index, segment] of segments.entries()) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const existingNode = currentChildren.find(
        (node) => node.id === currentPath
      )

      if (existingNode) {
        if (index < segments.length - 1) {
          if (!existingNode.children) {
            throw new Error(`Expected ${existingNode.id} to be a folder.`)
          }
          currentChildren = existingNode.children
        }
        continue
      }

      if (index === segments.length - 1) {
        currentChildren.push({ id: currentPath, name: segment })
        continue
      }

      const branch: GeneratedProjectNode = {
        id: currentPath,
        name: segment,
        children: [],
      }
      currentChildren.push(branch)
      currentChildren = branch.children ?? []
    }
  }

  sortProjectNodes(root.children ?? [], "")

  return root
}

const branchOrder: Record<string, readonly string[]> = {
  "": ["src", "assets", "scripts"],
  src: [
    "constants",
    "hooks",
    "lib",
    "types",
    "app",
    "components",
    "storage",
    "theme",
  ],
}

function sortProjectNodes(nodes: GeneratedProjectNode[], parentId: string) {
  const preferredNames = branchOrder[parentId] ?? []

  nodes.sort((first, second) => {
    const firstPreferredIndex = preferredNames.indexOf(first.name)
    const secondPreferredIndex = preferredNames.indexOf(second.name)
    const firstRank = firstPreferredIndex === -1 ? 100 : firstPreferredIndex
    const secondRank = secondPreferredIndex === -1 ? 100 : secondPreferredIndex

    if (firstRank !== secondRank) return firstRank - secondRank

    if (parentId === "assets") {
      if (first.name === "_global") return 1
      if (second.name === "_global") return -1
    }

    const firstIsBranch = Boolean(first.children)
    const secondIsBranch = Boolean(second.children)
    if (firstIsBranch !== secondIsBranch) return firstIsBranch ? -1 : 1

    return first.name.localeCompare(second.name)
  })

  for (const node of nodes) {
    if (node.children) sortProjectNodes(node.children, node.id)
  }
}

function GeneratedTreeNode({
  indexPath,
  node,
}: {
  indexPath: number[]
  node: GeneratedProjectNode
}) {
  const isBranch = Boolean(node.children?.length)

  return (
    <TreeViewNode indexPath={indexPath} node={node}>
      {isBranch ? (
        <TreeViewBranch>
          <TreeViewBranchItem>{node.name}</TreeViewBranchItem>
          <TreeViewBranchContent>
            {node.children?.map((child, index) => (
              <GeneratedTreeNode
                key={child.id}
                indexPath={[...indexPath, index]}
                node={child}
              />
            ))}
          </TreeViewBranchContent>
        </TreeViewBranch>
      ) : (
        <TreeViewContent>
          <TreeViewItem>{node.name}</TreeViewItem>
        </TreeViewContent>
      )}
    </TreeViewNode>
  )
}

export function SetupTypeVisualPrototype({
  setupType,
}: {
  setupType: SetupTypeStoryId
}) {
  const project = generatedProjects[setupType]
  const rootNode = createProjectRoot(project)
  const collection = createTreeCollection({ rootNode })

  return (
    <div className="h-80 overflow-hidden rounded-xl border border-background/15 bg-background text-foreground sm:h-96 lg:h-[25.5rem]">
      <div className="flex h-14 items-center justify-between gap-4 border-b px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.name}/</p>
          <p className="truncate text-xs text-muted-foreground">
            {project.summary}
          </p>
        </div>
        <Badge variant="secondary">{project.paths.length} files</Badge>
      </div>

      <ScrollArea className="h-[calc(100%-3.5rem)]">
        <TreeView
          collection={collection}
          defaultExpandedValue={[...project.defaultExpandedValue]}
          fileIcons={fileIcons}
          className="gap-0 py-2 [--indentation:--spacing(3)] [--item-gap:--spacing(1.5)] [--padding-block:--spacing(1)] [--padding-inline:--spacing(3)]"
        >
          <TreeViewLabel className="sr-only">
            Generated files for {project.name}
          </TreeViewLabel>
          <TreeViewTree>
            {rootNode.children?.map((node, index) => (
              <GeneratedTreeNode
                key={node.id}
                indexPath={[index]}
                node={node}
              />
            ))}
          </TreeViewTree>
        </TreeView>
      </ScrollArea>
    </div>
  )
}
