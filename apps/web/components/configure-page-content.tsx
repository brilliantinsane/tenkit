"use client"

import {
  AlertTriangleIcon,
  BoxesIcon,
  BracesIcon,
  DicesIcon,
  GitForkIcon,
  Layers3Icon,
  RotateCcwIcon,
  SwatchBookIcon,
  WindIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { PackageManagerIcon } from "@/components/command-block-primitives"
import { ConfiguratorAccentField } from "@/components/configurator-accent-field"
import {
  ConfiguratorCodeResponsiveComingSoonIconChoiceCard,
  ConfiguratorCodeResponsiveIconChoiceCard,
} from "@/components/configurator-choice-card"
import {
  ConfiguratorProvider,
  useConfigurator,
} from "@/components/configurator-provider"
import { ConfiguratorToggleRow } from "@/components/configurator-toggle-row"
import { ExpandableCodeBlockCommand } from "@/components/expandable-code-block-command"
import { FullWidthDivider } from "@/components/full-width-divider"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
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
  CONFIGURATOR_PACKAGE_MANAGER_OPTIONS,
  CONFIGURATOR_SETUP_TYPE_OPTIONS,
  CONFIGURATOR_STYLING_OPTIONS,
} from "@/lib/configurator"
import { cn } from "@/lib/utils"

const COMPACT_CONFIGURATOR_CARD_CLASS_NAME = "min-h-[18.125rem]"

const SETUP_TYPE_ICONS = {
  "white-label": <Layers3Icon className="size-4" aria-hidden="true" />,
  "runtime-tenants": <BoxesIcon className="size-4" aria-hidden="true" />,
  "generic-standalone": <GitForkIcon className="size-4" aria-hidden="true" />,
} satisfies Record<
  (typeof CONFIGURATOR_SETUP_TYPE_OPTIONS)[number]["value"],
  ReactNode
>

const STYLING_ICONS = {
  bare: <BracesIcon className="size-4" aria-hidden="true" />,
  uniwind: <WindIcon className="size-4" aria-hidden="true" />,
} satisfies Record<
  (typeof CONFIGURATOR_STYLING_OPTIONS)[number]["value"],
  ReactNode
>

const PACKAGE_MANAGER_ICONS = {
  pnpm: <PackageManagerIcon manager="pnpm" className="size-4" />,
  npm: <PackageManagerIcon manager="npm" className="size-4" />,
  bun: <PackageManagerIcon manager="bun" className="size-4" />,
} satisfies Record<
  (typeof CONFIGURATOR_PACKAGE_MANAGER_OPTIONS)[number]["value"],
  ReactNode
>

const UNISTYLES_ICON = <SwatchBookIcon className="size-4" aria-hidden="true" />
const RANDOMIZE_ICON = <DicesIcon data-icon="inline-start" />
const RESET_ICON = <RotateCcwIcon data-icon="inline-start" />

function ConfiguratorSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className="relative px-4 py-12 sm:px-8">
      <div
        className={cn(
          "flex flex-col gap-6 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5",
          className
        )}
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-lg font-semibold tracking-normal">
            {title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}

function ConfiguratorHero() {
  return (
    <section className="relative px-4 py-16 text-center sm:px-8 sm:py-24">
      <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Project configurator
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
        Shape the generated project, inspect the exact command, then copy it
        into your terminal.
      </p>
      <FullWidthDivider position="bottom" />
    </section>
  )
}

function ConfiguratorCommandPanel() {
  const { state, actions, meta } = useConfigurator()

  return (
    <aside className="z-10 min-w-0 px-4 py-12 sm:px-8 lg:sticky lg:top-16 lg:self-start">
      <div
        className={cn(
          "flex flex-col gap-5 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5",
          COMPACT_CONFIGURATOR_CARD_CLASS_NAME
        )}
      >
        <Field data-invalid={Boolean(meta.projectNameError)}>
          <FieldLabel htmlFor="page-configurator-project-name">
            Project name
          </FieldLabel>
          <Input
            id="page-configurator-project-name"
            value={state.projectName}
            aria-invalid={Boolean(meta.projectNameError)}
            onChange={(event) => actions.setProjectName(event.target.value)}
          />
          <FieldDescription>
            Spaces become hyphens in the generated folder name.
          </FieldDescription>
          {meta.projectNameError ? (
            <FieldError>{meta.projectNameError}</FieldError>
          ) : null}
        </Field>
        <Separator />
        <div
          id="configure-command"
          className="overflow-hidden rounded-xl border bg-card/80 p-1.5 shadow-sm"
        >
          <ExpandableCodeBlockCommand
            pnpm={meta.commands.pnpm}
            npm={meta.commands.npm}
            bun={meta.commands.bun}
            value={state.packageManager}
            copyDisabled={!meta.commandIsCopyable}
            onValueChange={actions.selectPackageManager}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Randomize configuration"
            onClick={actions.randomize}
          >
            {RANDOMIZE_ICON}
            Randomize
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={actions.reset}
          >
            {RESET_ICON}
            Reset defaults
          </Button>
        </div>
      </div>
    </aside>
  )
}

function ConfiguratorSetupTypeSection() {
  const { state, actions } = useConfigurator()

  return (
    <ConfiguratorSection
      title="Setup Type"
      description="Choose the relationship between native App Variants and Runtime Tenants."
      className={COMPACT_CONFIGURATOR_CARD_CLASS_NAME}
    >
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {CONFIGURATOR_SETUP_TYPE_OPTIONS.map((option) => (
          <ConfiguratorCodeResponsiveIconChoiceCard
            key={option.value}
            selected={state.setupType === option.value}
            label={option.label}
            detail={option.detail}
            icon={SETUP_TYPE_ICONS[option.value]}
            onSelect={() => actions.selectSetupType(option.value)}
          />
        ))}
      </div>
    </ConfiguratorSection>
  )
}

function ConfiguratorStylingSection() {
  const { state, actions } = useConfigurator()

  return (
    <ConfiguratorSection
      title="Styling"
      description="Pick the styling foundation generated with the Expo project."
      className={COMPACT_CONFIGURATOR_CARD_CLASS_NAME}
    >
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {CONFIGURATOR_STYLING_OPTIONS.map((option) => (
          <ConfiguratorCodeResponsiveIconChoiceCard
            key={option.value}
            selected={state.styling === option.value}
            label={option.label}
            detail={option.detail}
            icon={STYLING_ICONS[option.value]}
            onSelect={() => actions.selectStyling(option.value)}
          />
        ))}
        <ConfiguratorCodeResponsiveComingSoonIconChoiceCard
          label="Unistyles"
          icon={UNISTYLES_ICON}
        />
      </div>
    </ConfiguratorSection>
  )
}

function ConfiguratorAppVariantsSection() {
  const { actions, meta } = useConfigurator()

  return (
    <ConfiguratorSection
      title={meta.appVariantSectionTitle}
      description={meta.appVariantSectionDescription}
    >
      <div className="flex flex-col gap-6">
        {meta.appVariantFields.map((appVariantField) => (
          <div
            key={appVariantField.position}
            className="rounded-lg border bg-card/65 p-4 shadow-sm"
          >
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-sm font-semibold">
                {appVariantField.legend}
              </h3>
              {appVariantField.description ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {appVariantField.description}
                </p>
              ) : null}
            </div>

            <FieldGroup>
              <Field data-invalid={Boolean(appVariantField.nameError)}>
                <FieldLabel
                  htmlFor={`page-configurator-variant-name-${appVariantField.position}`}
                >
                  Name
                </FieldLabel>
                <Input
                  id={`page-configurator-variant-name-${appVariantField.position}`}
                  value={appVariantField.name}
                  aria-invalid={Boolean(appVariantField.nameError)}
                  onChange={(event) =>
                    actions.updateAppVariantName(
                      appVariantField.position,
                      event.target.value
                    )
                  }
                />
                {appVariantField.nameError ? (
                  <FieldError>{appVariantField.nameError}</FieldError>
                ) : null}
              </Field>

              <ConfiguratorAccentField
                id={`page-configurator-variant-accent-${appVariantField.position}`}
                label="Accent"
                value={appVariantField.accent}
                invalid={Boolean(appVariantField.accentError)}
                error={appVariantField.accentError}
                onChange={(accent) =>
                  actions.updateAppVariantAccent(
                    appVariantField.position,
                    accent
                  )
                }
              />
            </FieldGroup>

            {appVariantField.preview ? (
              <div className="mt-4 flex flex-col gap-1 rounded-md bg-muted/60 p-3 font-mono text-xs text-muted-foreground">
                {appVariantField.preview.warning ? (
                  <p className="mb-1 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangleIcon
                      aria-hidden="true"
                      className="size-3.5"
                    />
                    {appVariantField.preview.warning}
                  </p>
                ) : null}
                <span>Slug: {appVariantField.preview.slug}</span>
                <span>Scheme: {appVariantField.preview.scheme}</span>
                <span>iOS: {appVariantField.preview.bundleIdentifier}</span>
                <span>Android: {appVariantField.preview.packageName}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ConfiguratorSection>
  )
}

function ConfiguratorPackageManagerSection() {
  const { state, actions } = useConfigurator()

  return (
    <ConfiguratorSection
      title="Package manager"
      description="Choose the launcher, dependency install command, and generated lockfile format."
    >
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {CONFIGURATOR_PACKAGE_MANAGER_OPTIONS.map((option) => (
          <ConfiguratorCodeResponsiveIconChoiceCard
            key={option.value}
            selected={state.packageManager === option.value}
            label={option.label}
            detail={option.detail}
            icon={PACKAGE_MANAGER_ICONS[option.value]}
            onSelect={() => actions.selectPackageManager(option.value)}
          />
        ))}
      </div>

      <div className="rounded-lg border bg-card/65 px-4 shadow-sm">
        <ConfiguratorToggleRow
          id="page-configurator-install"
          label="Install dependencies"
          description="Run the selected package manager after generation."
          checked={state.install}
          onCheckedChange={actions.setInstall}
        />
        <Separator />
        <ConfiguratorToggleRow
          id="page-configurator-git"
          label="Initialize Git"
          description="Create an initial Git snapshot in the generated project."
          checked={state.git}
          onCheckedChange={actions.setGit}
        />
      </div>
    </ConfiguratorSection>
  )
}

const Configurator = {
  Provider: ConfiguratorProvider,
  Hero: ConfiguratorHero,
  CommandPanel: ConfiguratorCommandPanel,
  SetupTypeSection: ConfiguratorSetupTypeSection,
  StylingSection: ConfiguratorStylingSection,
  AppVariantsSection: ConfiguratorAppVariantsSection,
  PackageManagerSection: ConfiguratorPackageManagerSection,
} as const

function ConfiguratorPageFrame() {
  return (
    <main className="relative overflow-hidden supports-[overflow:clip]:overflow-clip">
      <div className="relative mx-auto w-[calc(100%-2rem)] max-w-6xl">
        <Configurator.Hero />
        <div className="grid lg:grid-cols-2">
          <Configurator.CommandPanel />
          <div className="min-w-0">
            <Configurator.SetupTypeSection />
            <Configurator.StylingSection />
            <Configurator.AppVariantsSection />
            <Configurator.PackageManagerSection />
          </div>
        </div>
        <div aria-hidden="true" className="relative h-px">
          <FullWidthDivider position="top" />
        </div>
        <SiteFooter commandHref="#configure-command" />
      </div>
    </main>
  )
}

export function ConfigurePageContent() {
  return (
    <Configurator.Provider>
      <ConfiguratorPageFrame />
    </Configurator.Provider>
  )
}
