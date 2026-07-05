import * as React from "react"

export function NpmMark(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M0 0v16h16V0H0zm13 13H8V5H5v8H3V3h10v10z"></path>
    </svg>
  )
}
