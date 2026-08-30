import {
  DEFAULT_GENERATED_APP_OPTIONS,
  getGeneratedAppOptionChoiceState,
  resolveGeneratedAppOptions,
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  SUPPORTED_GENERATED_AUTH_VALUES,
  SUPPORTED_GENERATED_BACKEND_VALUES,
  SUPPORTED_GENERATED_DATABASE_VALUES,
  SUPPORTED_GENERATED_ORM_VALUES,
  type GeneratedAppOptionChoice,
  type GeneratedAppOptions,
  type GeneratedAppOptionGroup,
  type RawGeneratedAppOptions,
} from "@tenkit/types/generated-app-option-definitions"

export const CONFIGURATOR_GENERATED_APP_OPTION_GROUPS = [
  "backend",
  "auth",
  "database",
  "orm",
] as const satisfies readonly GeneratedAppOptionGroup[]

export const PUBLIC_GENERATED_APP_OPTION_COUNT =
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.length

export const PUBLIC_GENERATED_APP_OPTION_SUMMARY = `${PUBLIC_GENERATED_APP_OPTION_COUNT} supported Backend, Auth, Database, and ORM combinations`

export const PUBLIC_GENERATED_APP_STACK_SUMMARY = `${PUBLIC_GENERATED_APP_OPTION_COUNT} supported generated stacks`

export const CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION = {
  backend: {
    label: "Backend",
    description: "Choose where your generated app serves its data.",
    options: {
      none: { label: "None", detail: "Expo app only" },
      express: { label: "Express", detail: "Minimal TypeScript server" },
      nestjs: { label: "NestJS", detail: "Structured TypeScript server" },
      convex: { label: "Convex", detail: "Managed backend and data" },
    },
  },
  auth: {
    label: "Auth",
    description: "Add identity and protected routes to the generated app.",
    options: {
      none: { label: "None", detail: "Public access" },
      "better-auth": { label: "Better Auth", detail: "Email and password" },
      clerk: { label: "Clerk", detail: "Hosted identity" },
    },
  },
  database: {
    label: "Database",
    description: "Choose persistence for a Node Backend.",
    options: {
      none: { label: "None", detail: "Backend Starter Data" },
      postgresql: { label: "PostgreSQL", detail: "SQL database" },
      mysql: { label: "MySQL", detail: "SQL database" },
    },
  },
  orm: {
    label: "ORM",
    description: "Choose the data access layer for SQL.",
    options: {
      none: { label: "None", detail: "Not applicable" },
      prisma: { label: "Prisma", detail: "Typed database client" },
      drizzle: { label: "Drizzle", detail: "Typed SQL toolkit" },
    },
  },
} as const satisfies {
  [Group in GeneratedAppOptionGroup]: {
    label: string
    description: string
    options: Record<
      GeneratedAppOptions[Group],
      { label: string; detail: string }
    >
  }
}

function moveNoneToEnd<Value extends string>(
  values: readonly Value[]
): readonly Value[] {
  return [
    ...values.filter((value) => value !== "none"),
    ...values.filter((value) => value === "none"),
  ]
}

export const CONFIGURATOR_GENERATED_APP_OPTION_OPTIONS = {
  backend: moveNoneToEnd(SUPPORTED_GENERATED_BACKEND_VALUES).map((value) => ({
    value,
    ...CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION.backend.options[value],
  })),
  auth: moveNoneToEnd(SUPPORTED_GENERATED_AUTH_VALUES).map((value) => ({
    value,
    ...CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION.auth.options[value],
  })),
  database: moveNoneToEnd(SUPPORTED_GENERATED_DATABASE_VALUES).map((value) => ({
    value,
    ...CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION.database.options[value],
  })),
  orm: moveNoneToEnd(SUPPORTED_GENERATED_ORM_VALUES).map((value) => ({
    value,
    ...CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION.orm.options[value],
  })),
} as const

export type ConfiguratorGeneratedAppOptionState = {
  selection: GeneratedAppOptions
  choices: {
    [Group in GeneratedAppOptionGroup]: GeneratedAppOptionChoice<
      GeneratedAppOptions[Group]
    >
  }
}

type ConfiguratorGeneratedAppOptionAdjustment = {
  group: GeneratedAppOptionGroup
  from: GeneratedAppOptions[GeneratedAppOptionGroup]
  to: GeneratedAppOptions[GeneratedAppOptionGroup]
}

type ConfiguratorGeneratedAppOptionUpdate = {
  selection: GeneratedAppOptions
  adjustments: readonly ConfiguratorGeneratedAppOptionAdjustment[]
}

function comparePreservedGeneratedAppOptions(
  currentSelection: GeneratedAppOptions,
  selectedGroup: GeneratedAppOptionGroup,
  left: GeneratedAppOptions,
  right: GeneratedAppOptions
): number {
  for (const group of CONFIGURATOR_GENERATED_APP_OPTION_GROUPS) {
    if (group === selectedGroup) {
      continue
    }

    const leftPreservesCurrent = left[group] === currentSelection[group]
    const rightPreservesCurrent = right[group] === currentSelection[group]

    if (leftPreservesCurrent !== rightPreservesCurrent) {
      return leftPreservesCurrent ? -1 : 1
    }
  }

  return 0
}

export function applyConfiguratorGeneratedAppOptionChoice<
  Group extends GeneratedAppOptionGroup,
>(
  currentSelection: GeneratedAppOptions,
  selectedGroup: Group,
  selectedValue: GeneratedAppOptions[Group]
): ConfiguratorGeneratedAppOptionUpdate {
  const compatibleSelections =
    SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.filter(
      (selection) => selection[selectedGroup] === selectedValue
    )
  const selection = compatibleSelections.sort((left, right) =>
    comparePreservedGeneratedAppOptions(
      currentSelection,
      selectedGroup,
      left,
      right
    )
  )[0]

  if (selection === undefined) {
    throw new Error(
      `Generated App Option ${selectedGroup}=${selectedValue} has no supported combination.`
    )
  }

  const adjustments = CONFIGURATOR_GENERATED_APP_OPTION_GROUPS.flatMap(
    (group): ConfiguratorGeneratedAppOptionAdjustment[] => {
      if (
        group === selectedGroup ||
        selection[group] === currentSelection[group]
      ) {
        return []
      }

      return [
        {
          group,
          from: currentSelection[group],
          to: selection[group],
        },
      ]
    }
  )

  return { selection, adjustments }
}

export function getConfiguratorGeneratedAppOptionAdjustmentDescription(
  currentSelection: GeneratedAppOptions,
  update: ConfiguratorGeneratedAppOptionUpdate
): string {
  return update.adjustments
    .map((adjustment) => {
      const groupLabel =
        CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION[adjustment.group].label
      const fromLabel = getConfiguratorGeneratedAppOptionLabel(
        adjustment.group,
        adjustment.from,
        currentSelection.backend
      )
      const toLabel = getConfiguratorGeneratedAppOptionLabel(
        adjustment.group,
        adjustment.to,
        update.selection.backend
      )

      return `${groupLabel} changed from ${fromLabel} to ${toLabel}.`
    })
    .join(" ")
}

function chooseValue<Value extends string>(
  choice: GeneratedAppOptionChoice<Value>,
  requestedValue: string | undefined,
  defaultValue: Value
): Value {
  const requestedChoice = choice.values.find(
    (value) => value === requestedValue
  )

  if (requestedChoice !== undefined) {
    return requestedChoice
  }

  if (choice.value !== undefined) {
    return choice.value
  }

  const defaultChoice = choice.values.find((value) => value === defaultValue)

  if (defaultChoice !== undefined) {
    return defaultChoice
  }

  const firstChoice = choice.values[0]

  if (firstChoice === undefined) {
    throw new Error("Generated App Option compatibility returned no choices.")
  }

  return firstChoice
}

function selectedChoice<Value extends string>(
  choice: GeneratedAppOptionChoice<Value>,
  value: Value
): GeneratedAppOptionChoice<Value> {
  return {
    ...choice,
    status: choice.values.length === 1 ? "resolved" : "selected",
    value,
  }
}

export function getConfiguratorGeneratedAppOptionsState(
  rawSelection: RawGeneratedAppOptions
): ConfiguratorGeneratedAppOptionState {
  const backendChoices = getGeneratedAppOptionChoiceState({})

  if (backendChoices.status === "invalid") {
    throw new Error(
      "Generated App Option compatibility has no Backend choices."
    )
  }

  const backend = chooseValue(
    backendChoices.backend,
    rawSelection.backend,
    DEFAULT_GENERATED_APP_OPTIONS.backend
  )
  const authChoices = getGeneratedAppOptionChoiceState({ backend })

  if (authChoices.status === "invalid") {
    throw new Error("Generated App Option compatibility has no Auth choices.")
  }

  const auth = chooseValue(
    authChoices.auth,
    rawSelection.auth,
    DEFAULT_GENERATED_APP_OPTIONS.auth
  )
  const databaseChoices = getGeneratedAppOptionChoiceState({ backend, auth })

  if (databaseChoices.status === "invalid") {
    throw new Error(
      "Generated App Option compatibility has no Database choices."
    )
  }

  const database = chooseValue(
    databaseChoices.database,
    rawSelection.database,
    DEFAULT_GENERATED_APP_OPTIONS.database
  )
  const ormChoices = getGeneratedAppOptionChoiceState({
    backend,
    auth,
    database,
  })

  if (ormChoices.status === "invalid") {
    throw new Error("Generated App Option compatibility has no ORM choices.")
  }

  const orm = chooseValue(
    ormChoices.orm,
    rawSelection.orm,
    DEFAULT_GENERATED_APP_OPTIONS.orm
  )
  const selection = {
    backend,
    auth,
    database,
    orm,
  } satisfies GeneratedAppOptions
  const resolution = resolveGeneratedAppOptions(selection)

  if (resolution.status === "invalid") {
    throw new Error("Generated App Option compatibility could not resolve.")
  }

  return {
    selection: resolution.selection,
    choices: {
      backend: selectedChoice(backendChoices.backend, backend),
      auth: selectedChoice(authChoices.auth, auth),
      database: selectedChoice(databaseChoices.database, database),
      orm: selectedChoice(ormChoices.orm, orm),
    },
  }
}

export function isDefaultGeneratedAppOptions(
  selection: GeneratedAppOptions
): boolean {
  return CONFIGURATOR_GENERATED_APP_OPTION_GROUPS.every(
    (group) => selection[group] === DEFAULT_GENERATED_APP_OPTIONS[group]
  )
}

export function getConfiguratorGeneratedAppOptionLabel(
  group: GeneratedAppOptionGroup,
  value: string,
  backend: GeneratedAppOptions["backend"]
): string {
  if (group === "database" && backend === "convex" && value === "none") {
    return "Convex-managed"
  }

  if (group === "orm" && backend === "convex" && value === "none") {
    return "Not applicable"
  }

  const option = Object.entries(
    CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION[group].options
  ).find(([optionValue]) => optionValue === value)?.[1]

  if (option === undefined) {
    throw new Error(`Missing Configurator presentation for ${group} ${value}.`)
  }

  return option.label
}

export function getConfiguratorGeneratedAppOptionStatusCopy(
  group: GeneratedAppOptionGroup,
  selection: GeneratedAppOptions
): string {
  if (group === "auth" && selection.backend === "none") {
    return "Auth is not applicable without a Backend."
  }

  if (group === "database" && selection.backend === "none") {
    return "Database is not applicable without a Backend."
  }

  if (group === "database" && selection.backend === "convex") {
    return "Convex manages persistence, so SQL Database is not applicable."
  }

  if (group === "orm" && selection.backend === "convex") {
    return "Convex manages persistence, so an SQL ORM is not applicable."
  }

  if (group === "orm" && selection.database === "none") {
    return "An ORM is only available after selecting a SQL Database."
  }

  return CONFIGURATOR_GENERATED_APP_OPTION_PRESENTATION[group].description
}
