"use client"

import {
  Building2Icon,
  Code2Icon,
  GitBranchIcon,
  KeyRoundIcon,
  PackageCheckIcon,
  PanelsTopLeftIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  StoreIcon,
  WifiIcon,
} from "lucide-react"

import type { SetupTypeStoryId } from "@/components/setup-type-stories-section"
import { Badge } from "@/components/ui/badge"
import {
  CircuitBoard,
  type CircuitConnection,
  type CircuitNode,
} from "@/components/ui/circuit-board"

type SetupGraph = {
  nodes: readonly CircuitNode[]
  connections: readonly CircuitConnection[]
  note: string
}

const setupAccent = {
  "white-label": "var(--info)",
  "runtime-tenants": "var(--warning)",
  hybrid: "var(--success)",
} satisfies Record<SetupTypeStoryId, string>

const relationshipLabels = {
  "white-label":
    "Shared product code produces separately branded customer App Variants.",
  "runtime-tenants":
    "One installed App Variant opens permitted Runtime Tenants after sign-in.",
  hybrid:
    "Shared product code supports a Generic App Variant and a Standalone App Variant.",
} satisfies Record<SetupTypeStoryId, string>

function NetworkTopologyGraph(setupType: SetupTypeStoryId): SetupGraph {
  if (setupType === "white-label") {
    return {
      nodes: [
        {
          id: "source",
          x: 240,
          y: 82,
          label: "Shared product code",
          icon: <WifiIcon className="size-4" />,
          status: "active",
          size: "lg",
        },
        {
          id: "app-a",
          x: 100,
          y: 220,
          label: "Gym app A",
          icon: <SmartphoneIcon className="size-4" />,
          status: "active",
        },
        {
          id: "app-b",
          x: 240,
          y: 220,
          label: "Gym app B",
          icon: <SmartphoneIcon className="size-4" />,
          status: "processing",
        },
        {
          id: "app-next",
          x: 380,
          y: 220,
          label: "Next customer app",
          icon: <SmartphoneIcon className="size-4" />,
          status: "active",
        },
      ],
      connections: ["app-a", "app-b", "app-next"].map((to) => ({
        from: "source",
        to,
        animated: true,
      })),
      note: "One maintained product. A separate App Variant for every customer.",
    }
  }

  if (setupType === "runtime-tenants") {
    return {
      nodes: [
        {
          id: "app",
          x: 240,
          y: 82,
          label: "Coworking app",
          icon: <WifiIcon className="size-4" />,
          status: "active",
          size: "lg",
        },
        ...["Location A", "Location B", "Location C"].map((label, index) => ({
          id: `tenant-${index}`,
          x: 100 + index * 140,
          y: 220,
          label,
          icon: <Building2Icon className="size-4" />,
          status: index === 1 ? ("processing" as const) : ("active" as const),
        })),
      ],
      connections: [0, 1, 2].map((index) => ({
        from: "app",
        to: `tenant-${index}`,
        animated: true,
      })),
      note: "Members install one App Variant, then open permitted Runtime Tenants.",
    }
  }

  return {
    nodes: [
      {
        id: "source",
        x: 240,
        y: 48,
        label: "Shared product code",
        icon: <WifiIcon className="size-4" />,
        status: "active",
        size: "lg",
      },
      {
        id: "generic",
        x: 130,
        y: 150,
        label: "Shared network app",
        icon: <SmartphoneIcon className="size-4" />,
        status: "processing",
      },
      {
        id: "standalone",
        x: 350,
        y: 150,
        label: "Partner app",
        icon: <StoreIcon className="size-4" />,
        status: "active",
      },
      {
        id: "generic-tenants",
        x: 130,
        y: 246,
        label: "Many Runtime Tenants",
        icon: <Building2Icon className="size-4" />,
        status: "active",
        size: "sm",
      },
      {
        id: "fixed-tenant",
        x: 350,
        y: 246,
        label: "One fixed Runtime Tenant",
        icon: <Building2Icon className="size-4" />,
        status: "active",
        size: "sm",
      },
    ],
    connections: [
      { from: "source", to: "generic", animated: true },
      { from: "source", to: "standalone", animated: true },
      { from: "generic", to: "generic-tenants", animated: true },
      { from: "standalone", to: "fixed-tenant", animated: true },
    ],
    note: "The Generic and Standalone App Variants remain part of one product.",
  }
}

function LoadBalancerGraph(setupType: SetupTypeStoryId): SetupGraph {
  const graphContent = {
    "white-label": {
      labels: [
        "Product source",
        "Brand configs",
        "Gym app A",
        "Gym app B",
        "App releases",
      ],
      icons: [
        Code2Icon,
        GitBranchIcon,
        SmartphoneIcon,
        SmartphoneIcon,
        PackageCheckIcon,
      ],
      note: "Brand configuration routes one product into separate customer releases.",
    },
    "runtime-tenants": {
      labels: [
        "Member app",
        "Access rules",
        "Location A",
        "Location B",
        "Opened workspace",
      ],
      icons: [
        SmartphoneIcon,
        KeyRoundIcon,
        Building2Icon,
        Building2Icon,
        PanelsTopLeftIcon,
      ],
      note: "Runtime access determines which tenant context opens inside one app.",
    },
    hybrid: {
      labels: [
        "Shared product code",
        "App setup",
        "Network app",
        "Partner app",
        "Store releases",
      ],
      icons: [
        Code2Icon,
        GitBranchIcon,
        SmartphoneIcon,
        StoreIcon,
        PackageCheckIcon,
      ],
      note: "The Setup Type routes one product into shared and standalone releases.",
    },
  } as const
  const content = graphContent[setupType]
  const positions = [
    [60, 150],
    [180, 150],
    [300, 80],
    [300, 220],
    [420, 150],
  ] as const
  const ids = ["input", "router", "path-a", "path-b", "output"] as const

  return {
    nodes: ids.map((id, index) => {
      const Icon = content.icons[index]
      return {
        id,
        x: positions[index][0],
        y: positions[index][1],
        label: content.labels[index],
        icon: <Icon className="size-4" />,
        status:
          id === "router"
            ? ("processing" as const)
            : id === "input" || id === "output"
              ? ("active" as const)
              : undefined,
        size: id === "router" ? ("lg" as const) : undefined,
      }
    }),
    connections: [
      { from: "input", to: "router", animated: true },
      { from: "router", to: "path-a", animated: true },
      { from: "router", to: "path-b", animated: true },
      { from: "path-a", to: "output", animated: true },
      { from: "path-b", to: "output", animated: true },
    ],
    note: content.note,
  }
}

function SimpleFlowGraph(setupType: SetupTypeStoryId): SetupGraph {
  const graphContent = {
    "white-label": {
      labels: [
        "Product source",
        "Brand identity",
        "Native identity",
        "Customer App Variants",
      ],
      icons: [Code2Icon, StoreIcon, ShieldCheckIcon, SmartphoneIcon],
      note: "Each customer identity becomes a separately branded App Variant.",
    },
    "runtime-tenants": {
      labels: [
        "Installed app",
        "Sign-in",
        "Access rules",
        "Runtime Tenant context",
      ],
      icons: [SmartphoneIcon, KeyRoundIcon, ShieldCheckIcon, Building2Icon],
      note: "Sign-in and access rules resolve the Runtime Tenant shown in one app.",
    },
    hybrid: {
      labels: [
        "Product source",
        "Generic path",
        "Standalone path",
        "App releases",
      ],
      icons: [Code2Icon, SmartphoneIcon, StoreIcon, PackageCheckIcon],
      note: "Two release paths converge on one maintained product workflow.",
    },
  } as const
  const content = graphContent[setupType]
  const positions = [
    [70, 150],
    [240, 80],
    [240, 220],
    [410, 150],
  ] as const
  const ids = ["input", "path-a", "path-b", "output"] as const

  return {
    nodes: ids.map((id, index) => {
      const Icon = content.icons[index]
      return {
        id,
        x: positions[index][0],
        y: positions[index][1],
        label: content.labels[index],
        icon: <Icon className="size-4" />,
        status:
          id === "input" || id === "output"
            ? ("active" as const)
            : index === 1
              ? ("processing" as const)
              : undefined,
      }
    }),
    connections: [
      { from: "input", to: "path-a", animated: true },
      { from: "input", to: "path-b", animated: true },
      { from: "path-a", to: "output", animated: true },
      { from: "path-b", to: "output", animated: true },
    ],
    note: content.note,
  }
}

function ComponentryPrototype({
  graph,
  label,
  pattern,
  setupType,
}: {
  graph: SetupGraph
  label: string
  pattern: string
  setupType: SetupTypeStoryId
}) {
  return (
    <div
      role="group"
      aria-label={relationshipLabels[setupType]}
      className="relative h-80 overflow-hidden rounded-xl border border-background/20 bg-background/[0.08] text-background sm:h-96 lg:h-[25.5rem]"
    >
      <Badge
        variant="outline"
        className="absolute top-4 left-4 z-20 border-background/20 bg-foreground/80 text-background"
      >
        {pattern}
      </Badge>

      <div className="absolute inset-x-2 top-11 bottom-14 sm:inset-x-4 sm:top-12">
        <CircuitBoard
          className="h-full"
          nodes={graph.nodes}
          connections={graph.connections}
          pulseColor={setupAccent[setupType]}
          nodeColor="var(--background)"
          traceColor="color-mix(in oklab, var(--background) 44%, transparent)"
          gridColor="color-mix(in oklab, var(--background) 18%, transparent)"
          pulseSpeed={2.3}
          traceWidth={1.75}
        />
      </div>

      <p className="absolute inset-x-5 bottom-4 text-center text-xs leading-5 font-medium text-background/80">
        {graph.note}
      </p>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function SetupTypeVisualPrototype({
  setupType,
}: {
  setupType: SetupTypeStoryId
}) {
  if (setupType === "white-label") {
    return (
      <ComponentryPrototype
        graph={NetworkTopologyGraph(setupType)}
        label="Componentry Network Topology"
        pattern="Branded app releases"
        setupType={setupType}
      />
    )
  }

  if (setupType === "hybrid") {
    return (
      <ComponentryPrototype
        graph={LoadBalancerGraph(setupType)}
        label="Componentry Load Balancer"
        pattern="Shared + standalone releases"
        setupType={setupType}
      />
    )
  }

  return (
    <ComponentryPrototype
      graph={SimpleFlowGraph(setupType)}
      label="Componentry Simple Flow"
      pattern="Runtime access flow"
      setupType={setupType}
    />
  )
}
