"use client"

import { useAtom } from "jotai"
import {
  AlertTriangleIcon,
  BoxesIcon,
  GitForkIcon,
  Layers3Icon,
  RotateCcwIcon,
  SettingsIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useQueryStates } from "nuqs"
import { useEffect, useState, type MouseEvent } from "react"

import { ConfiguratorAccentField } from "@/components/configurator-accent-field"
import {
  ConfiguratorChoiceCard,
  ConfiguratorIconChoiceCard,
} from "@/components/configurator-choice-card"
import { ConfiguratorCommandFooter } from "@/components/configurator-command-footer"
import { ConfiguratorToggleRow } from "@/components/configurator-toggle-row"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useConfiguratorOpen } from "@/hooks/use-configurator-open"
import { useHydrated } from "@/hooks/use-hydrated"
import {
  buildConfiguratorCommand,
  createDefaultConfiguratorState,
  deriveConfiguratorAppVariantPreviews,
  getConfiguratorAppVariantSectionCopy,
  isConfiguratorAccentHex,
  parseSerializedAppVariantAccents,
  serializeAppVariantAccents,
  serializeAppVariantNames,
  updateAppVariantValue,
  validateConfiguratorAppVariantNames,
} from "@/lib/configurator"
import {
  configuratorNudgeAtom,
  dismissConfiguratorNudge,
} from "@/lib/configurator-nudge"
import {
  configuratorCloseOptions,
  configuratorSearchParams,
  configuratorUrlKeys,
  getConfiguratorCloseReset,
  getConfiguratorDefaultsReset,
} from "@/lib/configurator-search-params"
import { cn } from "@/lib/utils"

const setupTypeOptions = [
  {
    value: "white-label" as const,
    label: "White label",
    detail: "Separate App Variant per brand",
    icon: <Layers3Icon className="size-4" aria-hidden="true" />,
  },
  {
    value: "runtime-tenants" as const,
    label: "Runtime",
    detail: "One app, many Runtime Tenants",
    icon: <BoxesIcon className="size-4" aria-hidden="true" />,
  },
  {
    value: "generic-standalone" as const,
    label: "Generic",
    detail: "Hybrid with standalone breakouts",
    icon: <GitForkIcon className="size-4" aria-hidden="true" />,
  },
] as const

const stylingOptions = [
  {
    value: "bare" as const,
    label: "Bare",
    detail: "Expo with StyleSheet",
  },
  {
    value: "uniwind" as const,
    label: "Uniwind",
    detail: "Tailwind on native",
  },
] as const

const packageManagerOptions = [
  {
    value: "pnpm" as const,
    label: "pnpm",
    detail: "Default package manager",
  },
  {
    value: "npm" as const,
    label: "npm",
    detail: "Ships with Node.js",
  },
  {
    value: "bun" as const,
    label: "bun",
    detail: "Fast Bun toolchain",
  },
] as const

function splitOrDefault(serialized: string, defaults: readonly string[]) {
  const values = serialized ? serialized.split(",") : defaults
  return values.length === defaults.length ? values : defaults
}

function useConfiguratorQuery() {
  return useQueryStates(configuratorSearchParams, {
    urlKeys: configuratorUrlKeys,
  })
}

const INITIAL_CONFIGURATOR_DEFAULTS = createDefaultConfiguratorState()
const CONFIGURATOR_NUDGE_DURATION = 1.2
const configuratorNudgeBounceY = [0, -5, 0, -4, 0, -2.5, 0]
const configuratorNudgeRotation = [0, -20, 55, 120, 190, 280, 360]
const configuratorNudgeBaseOpacity = [1, 0, 1, 0, 1, 0, 1]
const configuratorNudgeAccentOpacity = [0, 1, 0, 1, 0, 1, 0]
const configuratorNudgeTimes = [0, 0.14, 0.28, 0.43, 0.58, 0.76, 1]

export function ConfiguratorDialogTrigger({
  className,
}: {
  className?: string
}) {
  const [configuratorOpen, setConfiguratorOpen] = useConfiguratorOpen()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [nudge, setNudge] = useAtom(configuratorNudgeAtom)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!nudge.active) {
      return
    }

    const hideTooltipTimer = window.setTimeout(() => {
      dismissConfiguratorNudge(setNudge)
    }, CONFIGURATOR_NUDGE_DURATION * 1000)

    return () => window.clearTimeout(hideTooltipTimer)
  }, [nudge.active, setNudge])

  function closeTooltip() {
    setTooltipOpen(false)
    dismissConfiguratorNudge(setNudge)
  }

  function openConfigurator(event: MouseEvent<HTMLButtonElement>) {
    closeTooltip()
    event.currentTarget.blur()
    void setConfiguratorOpen(true)
  }

  return (
    <Tooltip
      open={!configuratorOpen && (nudge.active || tooltipOpen)}
      onOpenChange={(open) => {
        if (!configuratorOpen) {
          setTooltipOpen(open)
        }
      }}
    >
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-6 rounded-md border-none [&_svg:not([class*='size-'])]:size-3.5",
            className
          )}
          aria-label="Configure create command"
          onPointerDown={closeTooltip}
          onClick={openConfigurator}
        >
          <motion.span
            key={nudge.sequence}
            animate={
              nudge.active && !shouldReduceMotion
                ? {
                    rotate: configuratorNudgeRotation,
                    y: configuratorNudgeBounceY,
                  }
                : { rotate: 0, y: 0 }
            }
            transition={{
              duration: CONFIGURATOR_NUDGE_DURATION,
              ease: "linear",
              times: configuratorNudgeTimes,
            }}
            className="relative inline-flex size-3.5 items-center justify-center"
          >
            <span className="relative inline-flex size-3.5">
              <motion.span
                aria-hidden="true"
                animate={
                  nudge.active && !shouldReduceMotion
                    ? { opacity: configuratorNudgeBaseOpacity }
                    : { opacity: 1 }
                }
                transition={{
                  duration: CONFIGURATOR_NUDGE_DURATION,
                  ease: "linear",
                  times: configuratorNudgeTimes,
                }}
                className="absolute inset-0"
              >
                <SettingsIcon className="pointer-events-none size-3.5" />
              </motion.span>
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={
                  nudge.active && !shouldReduceMotion
                    ? { opacity: configuratorNudgeAccentOpacity }
                    : { opacity: 0 }
                }
                transition={{
                  duration: CONFIGURATOR_NUDGE_DURATION,
                  ease: "linear",
                  times: configuratorNudgeTimes,
                }}
                className="absolute inset-0 text-[#208AEF]/50"
              >
                <SettingsIcon className="pointer-events-none size-3.5" />
              </motion.span>
            </span>
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        Configure
      </TooltipContent>
    </Tooltip>
  )
}

export function ConfiguratorDialog() {
  const [query, setQuery] = useConfiguratorQuery()
  const [commandExpanded, setCommandExpanded] = useState(false)
  const [closingQuery, setClosingQuery] = useState<typeof query | null>(null)
  const [resetTooltipOpen, setResetTooltipOpen] = useState(false)
  const hydrated = useHydrated()
  const displayedQuery = query.open ? query : (closingQuery ?? query)
  const defaults = createDefaultConfiguratorState(displayedQuery.setupType)
  const appVariantSection = getConfiguratorAppVariantSectionCopy(
    displayedQuery.setupType
  )
  const appVariantNames = splitOrDefault(
    displayedQuery.appVariantNamesSerialized,
    defaults.appVariantNames
  )
  const appVariantAccents = parseSerializedAppVariantAccents(
    displayedQuery.appVariantAccentsSerialized,
    defaults.appVariantAccents
  )
  const hasChanges =
    displayedQuery.projectName !== INITIAL_CONFIGURATOR_DEFAULTS.projectName ||
    displayedQuery.setupType !== INITIAL_CONFIGURATOR_DEFAULTS.setupType ||
    displayedQuery.styling !== INITIAL_CONFIGURATOR_DEFAULTS.styling ||
    displayedQuery.packageManager !==
      INITIAL_CONFIGURATOR_DEFAULTS.packageManager ||
    displayedQuery.appVariantNamesSerialized !== "" ||
    displayedQuery.appVariantAccentsSerialized !== "" ||
    displayedQuery.git !== INITIAL_CONFIGURATOR_DEFAULTS.git ||
    displayedQuery.install !== INITIAL_CONFIGURATOR_DEFAULTS.install
  const nameErrors = validateConfiguratorAppVariantNames(appVariantNames)
  const accentErrors = appVariantAccents.map((accent) =>
    isConfiguratorAccentHex(accent)
      ? undefined
      : "Use a six-digit hex color such as #208AEF."
  )
  const hasErrors = [...nameErrors, ...accentErrors].some(Boolean)
  const previews = appVariantNames.map((name) => {
    try {
      return deriveConfiguratorAppVariantPreviews([name])[0]
    } catch {
      return undefined
    }
  })

  let command = "Fix validation errors to copy a create command."
  let commandIsCopyable = false

  if (!hasErrors) {
    try {
      command = buildConfiguratorCommand({
        projectName: displayedQuery.projectName,
        setupType: displayedQuery.setupType,
        styling: displayedQuery.styling,
        packageManager: displayedQuery.packageManager,
        appVariantNames,
        appVariantAccents,
        git: displayedQuery.git,
        install: displayedQuery.install,
      })
      commandIsCopyable = true
    } catch {
      command = "Enter a project name with a usable Latin letter or number."
    }
  }

  return (
    <Dialog
      open={hydrated && query.open}
      onOpenChange={(details) => {
        if (details.open || !hydrated || !query.open) {
          return
        }

        setCommandExpanded(false)
        setResetTooltipOpen(false)
        setClosingQuery(query)
        void setQuery(getConfiguratorCloseReset(), configuratorCloseOptions)
      }}
      onExitComplete={() => {
        setClosingQuery(null)
      }}
    >
      <DialogContent
        size="xl"
        className="flex max-h-[calc(100svh-2rem)] flex-col"
      >
        <DialogHeader
          className="border-b bg-muted/48"
          title="Configure create command"
          description="Shape the generated project before you open a terminal. Tenkit keeps project creation policy in the Public CLI and shows the exact reproducible command here."
        >
          <Tooltip open={resetTooltipOpen}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-11"
                aria-label="Reset to defaults"
                disabled={!hasChanges}
                onPointerEnter={() => {
                  if (hasChanges) {
                    setResetTooltipOpen(true)
                  }
                }}
                onPointerLeave={() => setResetTooltipOpen(false)}
                onPointerDown={() => setResetTooltipOpen(false)}
                onBlur={() => setResetTooltipOpen(false)}
                onClick={() => {
                  setCommandExpanded(false)
                  setResetTooltipOpen(false)
                  void setQuery(getConfiguratorDefaultsReset())
                }}
              >
                <RotateCcwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Reset to defaults
            </TooltipContent>
          </Tooltip>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody
            className={cn(
              "min-h-0 flex-1 pt-(--space)!",
              commandExpanded && "pointer-events-none"
            )}
            scrollFade
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="configurator-project-name">
                  Project name
                </FieldLabel>
                <Input
                  id="configurator-project-name"
                  value={displayedQuery.projectName}
                  onChange={(event) =>
                    setQuery({ projectName: event.target.value })
                  }
                />
                <FieldDescription>
                  This becomes your project folder name. Spaces turn into
                  hyphens in the command you copy.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Setup Type</FieldLabel>
                <div className="grid items-stretch gap-2 sm:grid-cols-3">
                  {setupTypeOptions.map((option) => (
                    <ConfiguratorIconChoiceCard
                      key={option.value}
                      selected={displayedQuery.setupType === option.value}
                      label={option.label}
                      detail={option.detail}
                      icon={option.icon}
                      onSelect={() => {
                        void setQuery({
                          setupType: option.value,
                          appVariantNamesSerialized: "",
                          appVariantAccentsSerialized: "",
                        })
                      }}
                    />
                  ))}
                </div>
              </Field>

              <Field>
                <FieldLabel>Styling</FieldLabel>
                <div className="grid items-stretch gap-2 sm:grid-cols-2">
                  {stylingOptions.map((option) => (
                    <ConfiguratorChoiceCard
                      key={option.value}
                      selected={displayedQuery.styling === option.value}
                      label={option.label}
                      detail={option.detail}
                      onSelect={() => {
                        void setQuery({ styling: option.value })
                      }}
                    />
                  ))}
                </div>
              </Field>

              <Field>
                <FieldLabel>{appVariantSection.sectionTitle}</FieldLabel>
                <FieldDescription>
                  {appVariantSection.sectionDescription}
                </FieldDescription>
                <div className="flex flex-col gap-4">
                  {appVariantNames.map((appVariantName, index) => {
                    const preview = previews[index]
                    const itemCopy = appVariantSection.items[index]

                    return (
                      <fieldset
                        key={index}
                        className="flex flex-col gap-4 rounded-lg border p-4"
                      >
                        <legend className="px-1 text-sm font-semibold">
                          {itemCopy?.legend}
                        </legend>
                        {itemCopy?.description ? (
                          <p className="text-xs text-muted-foreground">
                            {itemCopy.description}
                          </p>
                        ) : null}

                        <Field data-invalid={Boolean(nameErrors[index])}>
                          <FieldLabel
                            htmlFor={`configurator-variant-name-${index}`}
                          >
                            Name
                          </FieldLabel>
                          <Input
                            id={`configurator-variant-name-${index}`}
                            value={appVariantName}
                            aria-invalid={Boolean(nameErrors[index])}
                            onChange={(event) => {
                              const nextNames = updateAppVariantValue(
                                appVariantNames,
                                index,
                                event.target.value
                              )
                              void setQuery({
                                appVariantNamesSerialized:
                                  serializeAppVariantNames(
                                    nextNames,
                                    displayedQuery.setupType
                                  ),
                              })
                            }}
                          />
                          {nameErrors[index] ? (
                            <FieldError>{nameErrors[index]}</FieldError>
                          ) : null}
                        </Field>

                        <ConfiguratorAccentField
                          id={`configurator-variant-accent-${index}`}
                          label="Accent"
                          value={appVariantAccents[index]}
                          invalid={Boolean(accentErrors[index])}
                          error={accentErrors[index]}
                          onChange={(nextAccent) => {
                            const nextAccents = updateAppVariantValue(
                              appVariantAccents,
                              index,
                              nextAccent
                            )
                            void setQuery({
                              appVariantAccentsSerialized:
                                serializeAppVariantAccents(
                                  nextAccents,
                                  displayedQuery.setupType
                                ),
                            })
                          }}
                        />

                        {preview ? (
                          <div className="flex flex-col gap-1 rounded-md bg-muted/60 p-3 font-mono text-xs text-muted-foreground">
                            {preview.warning ? (
                              <p className="mb-1 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <AlertTriangleIcon className="size-3.5" />
                                {preview.warning}
                              </p>
                            ) : null}
                            <span>Slug: {preview.slug}</span>
                            <span>Scheme: {preview.scheme}</span>
                            <span>iOS: {preview.bundleIdentifier}</span>
                            <span>Android: {preview.packageName}</span>
                          </div>
                        ) : null}
                      </fieldset>
                    )
                  })}
                </div>
              </Field>

              <Field>
                <FieldLabel>Package manager</FieldLabel>
                <div className="grid items-stretch gap-2 sm:grid-cols-3">
                  {packageManagerOptions.map((option) => (
                    <ConfiguratorChoiceCard
                      key={option.value}
                      selected={displayedQuery.packageManager === option.value}
                      label={option.label}
                      detail={option.detail}
                      onSelect={() => {
                        void setQuery({
                          packageManager: option.value,
                        })
                      }}
                    />
                  ))}
                </div>
              </Field>

              <div className="rounded-lg border px-4">
                <ConfiguratorToggleRow
                  id="configurator-install"
                  label="Install dependencies"
                  description="Run the package manager install step after generation."
                  checked={displayedQuery.install}
                  onCheckedChange={(checked) => {
                    void setQuery({ install: checked })
                  }}
                />
                <Separator />
                <ConfiguratorToggleRow
                  id="configurator-git"
                  label="Initialize Git"
                  description="Create an initial Git snapshot in the generated project."
                  checked={displayedQuery.git}
                  onCheckedChange={(checked) => {
                    void setQuery({ git: checked })
                  }}
                />
              </div>
            </FieldGroup>
          </DialogBody>

          <ConfiguratorCommandFooter
            command={command}
            commandIsCopyable={commandIsCopyable}
            expanded={commandExpanded}
            onExpandedChange={setCommandExpanded}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
