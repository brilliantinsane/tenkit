"use client"

import { useQueryState } from "nuqs"

import {
  CONFIGURATOR_OPEN_URL_KEY,
  configuratorSearchParams,
} from "@/lib/configurator-search-params"

export function useConfiguratorOpen() {
  return useQueryState(CONFIGURATOR_OPEN_URL_KEY, configuratorSearchParams.open)
}
