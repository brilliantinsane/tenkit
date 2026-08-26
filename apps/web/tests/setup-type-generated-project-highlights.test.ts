import { generateProject } from "@tenkit/template-generator"
import {
  SUPPORTED_GENERATED_SETUP_TYPES,
  type GeneratedSetupType,
} from "@tenkit/types/setup-type-definitions"
import { describe, expect, test } from "vitest"

import { SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS } from "@/lib/setup-type-generated-project-highlights"

type SetupTypeStoryId = keyof typeof SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS

const storyIdByGeneratedSetupType = {
  "white-label-apps": "white-label",
  "single-app-runtime-tenants": "runtime-tenants",
  "generic-with-standalone-app-variants": "hybrid",
} as const satisfies Record<GeneratedSetupType, SetupTypeStoryId>

function readGeneratedPackageName(
  generatedProject: ReturnType<typeof generateProject>
) {
  const packageJson = generatedProject.find(
    (generatedFile) => generatedFile.path === "package.json"
  )

  if (!packageJson || typeof packageJson.contents !== "string") {
    throw new Error("Generated project must contain a text package.json file.")
  }

  const packageManifest: unknown = JSON.parse(packageJson.contents)

  if (
    typeof packageManifest !== "object" ||
    packageManifest === null ||
    !("name" in packageManifest) ||
    typeof packageManifest.name !== "string"
  ) {
    throw new Error("Generated package.json must contain a string name.")
  }

  return packageManifest.name
}

describe("Setup Type generated project highlights", () => {
  test("matches every displayed package name and path to generated output", () => {
    expect(new Set(Object.values(storyIdByGeneratedSetupType))).toEqual(
      new Set(Object.keys(SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS))
    )

    for (const generatedSetupType of SUPPORTED_GENERATED_SETUP_TYPES) {
      const storyId = storyIdByGeneratedSetupType[generatedSetupType]
      const highlights = SETUP_TYPE_GENERATED_PROJECT_HIGHLIGHTS[storyId]
      const generatedProject = generateProject({
        setupType: generatedSetupType,
      })
      const generatedPaths = new Set(
        generatedProject.map((generatedFile) => generatedFile.path)
      )

      expect(readGeneratedPackageName(generatedProject)).toBe(highlights.name)

      for (const path of highlights.paths) {
        expect(
          generatedPaths.has(path),
          `${storyId} tree path ${path} must exist in generated output`
        ).toBe(true)
      }
    }
  })
})
