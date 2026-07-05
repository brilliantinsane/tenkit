export const SETUP_TYPES = [
  {
    slug: "white-label-apps",
    label: "White Label Apps",
    eyebrow: "white-label",
    headline: "Separate store listing per brand.",
    description:
      "One shared Expo product, with each customer or brand owning its app name, icon set, bundle ID, package name, scheme, theme, and EAS project.",
    examples: [
      "One app per customer",
      "One EAS Project per App Variant",
      "Shared product code",
    ],
    phoneIndex: 0,
  },
  {
    slug: "single-app-runtime-tenants",
    label: "Runtime Tenant App",
    eyebrow: "runtime-tenants",
    headline: "One app, many runtime contexts.",
    description:
      "Ship one native app identity, then let the installed app open different businesses, organizations, or locations at runtime.",
    examples: [
      "One native app identity",
      "Selectable Runtime Tenants",
      "Runtime Tenant Access bootstrap data",
    ],
    phoneIndex: 1,
  },
  {
    slug: "generic-with-standalone-app-variants",
    label: "Generic + Standalone",
    eyebrow: "generic-standalone",
    headline: "A network app with selected breakouts.",
    description:
      "Most Runtime Tenants live inside a generic App Variant. Selected brands can also ship as standalone App Variants.",
    examples: [
      "Generic App Variant",
      "Standalone App Variants",
      "Excluded generic picker access",
    ],
    phoneIndex: 2,
  },
] as const

export const FAQ_ITEMS = [
  {
    id: "what-is-tenkit",
    question: "What is Tenkit?",
    answer:
      "Tenkit is an Expo-first toolkit for creating one mobile product around explicit setup data: App Variants, Runtime Tenants, native identity, and Build Preparation.",
  },
  {
    id: "cli-status",
    question: "Is the public create command available yet?",
    answer:
      "Yes. The current Tenkit repo includes the create-tenkit package surface, with create commands for pnpm, npm, npx, Bun, and bunx.",
  },
  {
    id: "backend",
    question: "Does Tenkit handle backend multi-tenancy?",
    answer:
      "No. Tenkit handles Expo project generation, native identity, setup data, and local build workflows. Your backend, billing, and admin product stay in your stack.",
  },
  {
    id: "setup-type",
    question: "How do I pick a setup type?",
    answer:
      "Choose the model that matches distribution: separate App Variants per brand, one App Variant with multiple Runtime Tenants, or a hybrid where a generic App Variant coexists with selected standalone App Variants.",
  },
  {
    id: "eas",
    question: "Why does each App Variant need its own EAS Project?",
    answer:
      "Each native app identity should own its release lane, environment values, and project ID. Tenkit maps each App Variant to exactly one EAS Project so Build Preparation can target the right native app on purpose.",
  },
] as const
