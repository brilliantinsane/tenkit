import {
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  type GeneratedAppOptions,
} from "@tenkit/types/generated-app-option-definitions"

import { getConfiguratorGeneratedAppOptionLabel } from "./generated-app-options"

export type DocsGeneratedAppOptionRow = {
  id: string
  values: readonly [string, string, string, string]
  selection: GeneratedAppOptions
}

export function getDocsGeneratedAppOptionRows(): readonly DocsGeneratedAppOptionRow[] {
  return SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((selection) => ({
    id: [
      selection.backend,
      selection.auth,
      selection.database,
      selection.orm,
    ].join("-"),
    values: [
      selection.backend,
      selection.auth,
      getConfiguratorGeneratedAppOptionLabel(
        "database",
        selection.database,
        selection.backend
      ),
      getConfiguratorGeneratedAppOptionLabel(
        "orm",
        selection.orm,
        selection.backend
      ),
    ],
    selection,
  }))
}
