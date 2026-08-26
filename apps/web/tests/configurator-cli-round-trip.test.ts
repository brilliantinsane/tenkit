import { describe, expect, test, vi } from "vitest"

import { normalizeGeneratedSetupType } from "@tenkit/template-generator"
import {
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  type GeneratedAppOptions,
} from "@tenkit/types/generated-app-option-definitions"
import { SUPPORTED_PUBLIC_SETUP_SLUGS } from "@tenkit/types/setup-type-definitions"

import { createProgram } from "../../../packages/cli/src/commands/create"
import type { CreateFlowEnvironment } from "../../../packages/cli/src/create/types"
import {
  buildConfiguratorCommand,
  createDefaultConfiguratorState,
} from "@/lib/configurator"

const ROUND_TRIP_CASES = SUPPORTED_PUBLIC_SETUP_SLUGS.flatMap((setupType) =>
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((generatedAppOptions) => ({
    setupType,
    generatedAppOptions,
  }))
)

function unwrapShellValue(value: string): string {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll(`'"'"'`, "'")
  }

  return value
}

function getPublicCliArguments(command: string): string[] {
  const [, ...flagParts] = command.split(/\s+(?=--)/)

  return flagParts.flatMap((flagPart) => {
    const separator = flagPart.indexOf(" ")

    if (separator === -1) {
      return [flagPart]
    }

    return [
      flagPart.slice(0, separator),
      unwrapShellValue(flagPart.slice(separator + 1)),
    ]
  })
}

function createCliEnvironment(
  generate: NonNullable<CreateFlowEnvironment["generate"]>
): CreateFlowEnvironment {
  return {
    cwd: process.cwd(),
    isInteractive: false,
    output: {
      log() {},
      error() {},
    },
    prompts: {
      text: async () => {
        throw new Error("Unexpected Public CLI text prompt.")
      },
      select: async () => {
        throw new Error("Unexpected Public CLI select prompt.")
      },
      confirm: async () => {
        throw new Error("Unexpected Public CLI confirm prompt.")
      },
    },
    generate,
  }
}

describe("Configurator Public CLI round trips", () => {
  test.each(ROUND_TRIP_CASES)(
    "resolves $setupType with the supported $generatedAppOptions.backend/$generatedAppOptions.auth/$generatedAppOptions.database/$generatedAppOptions.orm stack",
    async ({ setupType, generatedAppOptions }) => {
      const state = {
        ...createDefaultConfiguratorState(setupType),
        projectName: `round-trip-${setupType}-${generatedAppOptions.backend}-${generatedAppOptions.auth}-${generatedAppOptions.database}-${generatedAppOptions.orm}`,
        generatedAppOptions,
      }
      const command = buildConfiguratorCommand(state)
      const generate = vi.fn<NonNullable<CreateFlowEnvironment["generate"]>>(
        () => []
      )
      const program = createProgram(createCliEnvironment(generate))

      await expect(
        program.parseAsync(getPublicCliArguments(command), { from: "user" })
      ).resolves.toBe(program)

      expect(generate).toHaveBeenCalledOnce()
      expect(generate.mock.calls[0]?.[0]).toMatchObject({
        setupType: normalizeGeneratedSetupType(setupType),
        stylingChoice: "bare",
        generatedAppOptions,
      } satisfies {
        setupType: string
        stylingChoice: string
        generatedAppOptions: GeneratedAppOptions
      })
    }
  )
})
