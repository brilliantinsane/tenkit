"use client"

import { createContext, use, type ReactNode } from "react"
import { useQueryStates } from "nuqs"

import {
  buildConfiguratorCommand,
  createDefaultConfiguratorState,
  deriveConfiguratorState,
  getConfiguratorAppVariantSectionCopy,
  parseSerializedAppVariantAccents,
  parseSerializedAppVariantNames,
  randomizeConfiguratorState,
  serializeAppVariantAccents,
  serializeAppVariantNames,
  updateAppVariantValue,
  type ConfiguratorAppVariantPreview,
  type ConfiguratorPackageManager,
  type ConfiguratorState,
  type ConfiguratorStyling,
} from "@/lib/configurator"
import {
  getConfiguratorGeneratedAppOptionsState,
  type ConfiguratorGeneratedAppOptionState,
} from "@/lib/generated-app-options"
import type {
  GeneratedAuth,
  GeneratedBackend,
  GeneratedDatabase,
  GeneratedOrm,
} from "@tenkit/types/generated-app-option-definitions"
import {
  configuratorSearchParams,
  configuratorUrlKeys,
  getConfiguratorDefaultsReset,
} from "@/lib/configurator-search-params"
import { trackDatabuddyEvent } from "@/lib/databuddy"

type ConfiguratorAppVariantField = {
  position: number
  name: string
  accent: string
  legend: string
  description?: string
  nameError?: string
  accentError?: string
  preview?: ConfiguratorAppVariantPreview
}

type ConfiguratorActions = {
  randomize: () => void
  reset: () => void
  setProjectName: (projectName: string) => void
  selectSetupType: (setupType: ConfiguratorState["setupType"]) => void
  selectStyling: (styling: ConfiguratorStyling) => void
  selectPackageManager: (packageManager: ConfiguratorPackageManager) => void
  selectBackend: (value: GeneratedBackend) => void
  selectAuth: (value: GeneratedAuth) => void
  selectDatabase: (value: GeneratedDatabase) => void
  selectOrm: (value: GeneratedOrm) => void
  updateAppVariantName: (position: number, name: string) => void
  updateAppVariantAccent: (position: number, accent: string) => void
  setGit: (git: boolean) => void
  setInstall: (install: boolean) => void
}

type ConfiguratorMeta = {
  projectNameError?: string
  appVariantSectionTitle: string
  appVariantSectionDescription: string
  appVariantFields: readonly ConfiguratorAppVariantField[]
  generatedAppOptions: ConfiguratorGeneratedAppOptionState
  commands: Readonly<Record<ConfiguratorPackageManager, string>>
  commandIsCopyable: boolean
}

type ConfiguratorContextValue = {
  state: ConfiguratorState
  actions: ConfiguratorActions
  meta: ConfiguratorMeta
}

const ConfiguratorContext = createContext<ConfiguratorContextValue | null>(null)

export function useConfigurator(): ConfiguratorContextValue {
  const configurator = use(ConfiguratorContext)

  if (!configurator) {
    throw new Error("useConfigurator must be used inside ConfiguratorProvider.")
  }

  return configurator
}

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useQueryStates(configuratorSearchParams, {
    urlKeys: configuratorUrlKeys,
    history: "replace",
    shallow: true,
  })
  const defaults = createDefaultConfiguratorState(query.setupType)
  const generatedAppOptionsState = getConfiguratorGeneratedAppOptionsState({
    backend: query.backend,
    auth: query.auth,
    database: query.database,
    orm: query.orm,
  })
  const state: ConfiguratorState = {
    projectName: query.projectName,
    setupType: query.setupType,
    styling: query.styling,
    packageManager: query.packageManager,
    generatedAppOptions: generatedAppOptionsState.selection,
    appVariantNames: parseSerializedAppVariantNames(
      query.appVariantNamesSerialized,
      defaults.appVariantNames
    ),
    appVariantAccents: parseSerializedAppVariantAccents(
      query.appVariantAccentsSerialized,
      defaults.appVariantAccents
    ),
    git: query.git,
    install: query.install,
  }
  const derivedState = deriveConfiguratorState(state)
  const appVariantSection = getConfiguratorAppVariantSectionCopy(
    state.setupType
  )
  const commands = {
    pnpm: derivedState.commandIsCopyable
      ? buildConfiguratorCommand({ ...state, packageManager: "pnpm" })
      : derivedState.command,
    npm: derivedState.commandIsCopyable
      ? buildConfiguratorCommand({ ...state, packageManager: "npm" })
      : derivedState.command,
    bun: derivedState.commandIsCopyable
      ? buildConfiguratorCommand({ ...state, packageManager: "bun" })
      : derivedState.command,
  } satisfies Record<ConfiguratorPackageManager, string>
  const actions: ConfiguratorActions = {
    randomize: () => {
      const randomizedState = randomizeConfiguratorState(state)

      trackDatabuddyEvent("configurator_randomized", {
        setupType: randomizedState.setupType,
        styling: randomizedState.styling,
        packageManager: randomizedState.packageManager,
        ...randomizedState.generatedAppOptions,
        git: randomizedState.git,
        install: randomizedState.install,
      })

      void setQuery({
        setupType: randomizedState.setupType,
        styling: randomizedState.styling,
        packageManager: randomizedState.packageManager,
        backend: randomizedState.generatedAppOptions.backend,
        auth: randomizedState.generatedAppOptions.auth,
        database: randomizedState.generatedAppOptions.database,
        orm: randomizedState.generatedAppOptions.orm,
        appVariantNamesSerialized: serializeAppVariantNames(
          randomizedState.appVariantNames,
          randomizedState.setupType
        ),
        appVariantAccentsSerialized: serializeAppVariantAccents(
          randomizedState.appVariantAccents,
          randomizedState.setupType
        ),
        git: randomizedState.git,
        install: randomizedState.install,
      })
    },
    reset: () => {
      void setQuery(getConfiguratorDefaultsReset())
    },
    setProjectName: (projectName) => {
      void setQuery({ projectName })
    },
    selectSetupType: (setupType) => {
      if (setupType !== state.setupType) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "setup_type",
          value: setupType,
        })
      }

      void setQuery({
        setupType,
        appVariantNamesSerialized: "",
        appVariantAccentsSerialized: "",
      })
    },
    selectStyling: (styling) => {
      if (styling !== state.styling) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "styling",
          value: styling,
        })
      }

      void setQuery({ styling })
    },
    selectPackageManager: (packageManager) => {
      if (packageManager !== state.packageManager) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "package_manager",
          value: packageManager,
        })
      }

      void setQuery({ packageManager })
    },
    selectBackend: (backend) => {
      if (backend !== state.generatedAppOptions.backend) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "backend",
          value: backend,
        })
      }

      void setQuery({ backend, auth: null, database: null, orm: null })
    },
    selectAuth: (auth) => {
      if (auth !== state.generatedAppOptions.auth) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "auth",
          value: auth,
        })
      }

      const nextGeneratedAppOptions = getConfiguratorGeneratedAppOptionsState({
        backend: state.generatedAppOptions.backend,
        auth,
      }).selection

      void setQuery({
        auth,
        database: nextGeneratedAppOptions.database,
        orm: nextGeneratedAppOptions.orm,
      })
    },
    selectDatabase: (database) => {
      if (database !== state.generatedAppOptions.database) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "database",
          value: database,
        })
      }

      const nextGeneratedAppOptions = getConfiguratorGeneratedAppOptionsState({
        backend: state.generatedAppOptions.backend,
        auth: state.generatedAppOptions.auth,
        database,
      }).selection

      void setQuery({
        database,
        orm: nextGeneratedAppOptions.orm,
      })
    },
    selectOrm: (orm) => {
      if (orm !== state.generatedAppOptions.orm) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "orm",
          value: orm,
        })
      }

      void setQuery({ orm })
    },
    updateAppVariantName: (position, name) => {
      const appVariantNames = updateAppVariantValue(
        state.appVariantNames,
        position,
        name
      )
      void setQuery({
        appVariantNamesSerialized: serializeAppVariantNames(
          appVariantNames,
          state.setupType
        ),
      })
    },
    updateAppVariantAccent: (position, accent) => {
      const appVariantAccents = updateAppVariantValue(
        state.appVariantAccents,
        position,
        accent
      )
      void setQuery({
        appVariantAccentsSerialized: serializeAppVariantAccents(
          appVariantAccents,
          state.setupType
        ),
      })
    },
    setGit: (git) => {
      if (git !== state.git) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "git",
          value: git,
        })
      }

      void setQuery({ git })
    },
    setInstall: (install) => {
      if (install !== state.install) {
        trackDatabuddyEvent("configurator_choice_changed", {
          group: "install",
          value: install,
        })
      }

      void setQuery({ install })
    },
  }
  const appVariantFields = state.appVariantNames.map((name, position) => {
    const accent = state.appVariantAccents[position]
    const itemCopy = appVariantSection.items[position]

    if (accent === undefined || itemCopy === undefined) {
      throw new Error(
        `Configurator data for App Variant position ${position} is incomplete for Setup Type ${JSON.stringify(state.setupType)}.`
      )
    }

    return {
      position,
      name,
      accent,
      legend: itemCopy.legend,
      description: itemCopy.description,
      nameError: derivedState.nameErrors[position],
      accentError: derivedState.accentErrors[position],
      preview: derivedState.previews[position],
    }
  })

  return (
    <ConfiguratorContext
      value={{
        state,
        actions,
        meta: {
          projectNameError: derivedState.projectNameError,
          appVariantSectionTitle: appVariantSection.sectionTitle,
          appVariantSectionDescription: appVariantSection.sectionDescription,
          appVariantFields,
          generatedAppOptions: generatedAppOptionsState,
          commands,
          commandIsCopyable: derivedState.commandIsCopyable,
        },
      }}
    >
      {children}
    </ConfiguratorContext>
  )
}
