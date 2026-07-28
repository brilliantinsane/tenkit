// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

describe("Accordion", () => {
  test("keeps a visible focus treatment while toggling content", async () => {
    const user = userEvent.setup()

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="setup-types">
          <AccordionTrigger>What is a Setup Type?</AccordionTrigger>
          <AccordionContent>
            A relationship model for App Variants and Runtime Tenants.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    )

    const trigger = screen.getByRole("button", {
      name: "What is a Setup Type?",
    })

    expect(trigger.classList.contains("focus-visible:ring-3")).toBe(true)
    expect(trigger.classList.contains("focus-visible:ring-ring/30")).toBe(true)

    await user.click(trigger)

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(
      screen.getByText(
        "A relationship model for App Variants and Runtime Tenants."
      )
    ).toBeDefined()
  })
})
