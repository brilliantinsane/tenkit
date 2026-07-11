"use client"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerSlider,
  ColorPickerTrigger,
  ColorPickerValueSwatch,
} from "@/components/ui/color-picker"
import { normalizeConfiguratorAccentHex } from "@/lib/configurator"

type ConfiguratorAccentFieldProps = {
  id: string
  label: string
  value: string
  invalid?: boolean
  error?: string
  onChange: (value: string) => void
}

export function ConfiguratorAccentField({
  id,
  label,
  value,
  invalid,
  error,
  onChange,
}: ConfiguratorAccentFieldProps) {
  const normalizedHex = normalizeConfiguratorAccentHex(value)
  const displayColor = invalid ? "#000000" : normalizedHex

  function commitAccent(nextValue: string) {
    const normalized = normalizeConfiguratorAccentHex(nextValue)
    onChange(normalized)
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ColorPicker
        className="w-full"
        value={displayColor}
        onValueChange={(details) => {
          commitAccent(details.value.toString("hex"))
        }}
      >
        <ColorPickerControl className="w-full items-center gap-3">
          <ColorPickerTrigger
            aria-label={`${label} color`}
            className="h-9 w-14 shrink-0 overflow-hidden rounded-3xl border border-transparent bg-clip-padding p-0 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <ColorPickerValueSwatch className="size-full rounded-[inherit] border-0" />
          </ColorPickerTrigger>
          <Input
            id={id}
            value={normalizedHex}
            aria-invalid={invalid}
            className="min-w-0 flex-1"
            onChange={(event) => commitAccent(event.target.value)}
          />
        </ColorPickerControl>
        <ColorPickerContent>
          <ColorPickerArea>
            <ColorPickerAreaThumb />
          </ColorPickerArea>
          <ColorPickerSlider channel="hue" />
        </ColorPickerContent>
      </ColorPicker>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
