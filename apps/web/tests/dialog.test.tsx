// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

describe("Dialog", () => {
  test("composes its close action explicitly", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Composed dialog</DialogTitle>
          <DialogDescription>Composition test</DialogDescription>
          <DialogClose asChild>
            <button type="button">Dismiss</button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    )

    expect(
      screen.getAllByRole("button").map((button) => button.textContent)
    ).toEqual(["Dismiss"])
  })
})
