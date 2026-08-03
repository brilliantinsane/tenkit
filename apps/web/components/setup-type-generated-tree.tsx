"use client"

import {
  BracesIcon,
  FileCode2Icon,
  FileTextIcon,
  ImageIcon,
  Settings2Icon,
} from "lucide-react"

import type { SetupTypeStoryId } from "@/components/setup-type-stories-section"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import { Badge } from "@/components/ui/badge"
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
import { SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS } from "@/lib/setup-type-generated-project-highlights"

type GeneratedProjectNode = {
  id: string
  name: string
  children?: GeneratedProjectNode[]
}

type GeneratedProjectHighlights =
  (typeof SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS)[SetupTypeStoryId]

const fileIcons = createFileIcons({
  ".example": Settings2Icon,
  ".json": BracesIcon,
  ".md": FileTextIcon,
  ".png": ImageIcon,
  ".svg": ImageIcon,
  ".ts": FileCode2Icon,
  ".tsx": FileCode2Icon,
})

function createProjectRoot(
  project: GeneratedProjectHighlights
): GeneratedProjectNode {
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

export function SetupTypeGeneratedTree({
  setupType,
}: {
  setupType: SetupTypeStoryId
}) {
  const project = SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS[setupType]
  const rootNode = createProjectRoot(project)
  const collection = createTreeCollection({ rootNode })

  return (
    <div className="h-80 overflow-hidden rounded-xl border border-background/15 bg-background text-foreground lg:h-[23.25rem]">
      <div className="flex h-14 items-center justify-between gap-4 border-b px-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{project.label}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {project.description}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Key files
        </Badge>
      </div>

      <ScrollFadeEffect className="h-[calc(100%-3.5rem)] overscroll-contain">
        <TreeView
          key={setupType}
          collection={collection}
          defaultExpandedValue={[...project.defaultExpandedPaths]}
          fileIcons={fileIcons}
          className="gap-0 p-2 [--indentation:--spacing(3)] [--item-gap:--spacing(1.5)] [--padding-block:--spacing(1)] [--padding-inline:--spacing(3)]"
        >
          <TreeViewLabel className="sr-only">
            Key generated files for {project.label}
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
      </ScrollFadeEffect>
    </div>
  )
}
