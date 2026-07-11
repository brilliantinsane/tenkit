import { atom } from "jotai"

export type ConfiguratorNudge = {
  active: boolean
  sequence: number
}

export const configuratorNudgeAtom = atom<ConfiguratorNudge>({
  active: false,
  sequence: 0,
})

export function bumpConfiguratorNudge(
  setNudge: (update: (current: ConfiguratorNudge) => ConfiguratorNudge) => void
) {
  setNudge((current) => ({
    active: true,
    sequence: current.sequence + 1,
  }))
}

export function dismissConfiguratorNudge(
  setNudge: (update: (current: ConfiguratorNudge) => ConfiguratorNudge) => void
) {
  setNudge((current) =>
    current.active ? { ...current, active: false } : current
  )
}
