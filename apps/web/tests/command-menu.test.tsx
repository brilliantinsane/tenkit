// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

import { CommandMenu } from "@/components/command-menu"

describe("CommandMenu", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    )
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  test("opens with Ctrl+K and navigates to a selected destination", async () => {
    const user = userEvent.setup()
    render(<CommandMenu />)
    const shortcut = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "k",
    })

    document.dispatchEvent(shortcut)

    expect(shortcut.defaultPrevented).toBe(true)
    expect(
      await screen.findByRole("dialog", { name: "Command Palette" })
    ).toBeDefined()
    expect(
      screen.getByPlaceholderText("Search pages and sections...")
    ).toBeDefined()
    await user.type(
      screen.getByPlaceholderText("Search pages and sections..."),
      "missing"
    )
    expect(screen.getByText("No matching destination.")).toBeDefined()

    await user.clear(
      screen.getByPlaceholderText("Search pages and sections...")
    )

    await user.click(screen.getByText("Configurator"))

    expect(push).toHaveBeenCalledWith("/configure")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  test("opens with Meta+K and closes when the shortcut is repeated", async () => {
    render(<CommandMenu />)

    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(await screen.findByRole("dialog")).toBeDefined()

    fireEvent.keyDown(document, { key: "K", metaKey: true })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  test("opens from a visible trigger", async () => {
    const user = userEvent.setup()
    render(<CommandMenu />)

    await user.click(
      screen.getByRole("button", { name: "Open command palette" })
    )

    expect(
      await screen.findByRole("dialog", { name: "Command Palette" })
    ).toBeDefined()
  })
})
