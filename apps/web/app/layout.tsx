import { Dosis, Geist_Mono, Inter, Space_Grotesk } from "next/font/google"

import { Header } from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { rootMetadata, rootViewport } from "@/lib/site-metadata"
import { cn } from "@/lib/utils"
import "./globals.css"

export const metadata = rootMetadata
export const viewport = rootViewport

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const dosis = Dosis({
  subsets: ["latin"],
  variable: "--font-dosis",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        inter.className,
        inter.variable,
        spaceGrotesk.variable,
        fontMono.variable,
        dosis.variable
      )}
    >
      <body
        className={cn(
          inter.className,
          "min-h-svh overflow-x-clip bg-background text-foreground"
        )}
      >
        <ThemeProvider>
          <TooltipProvider>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-x-4 inset-y-0 z-40 mx-auto max-w-6xl"
            >
              <span className="absolute inset-y-0 left-0 w-px bg-border" />
              <span className="absolute inset-y-0 right-0 w-px bg-border" />
            </div>
            <Header />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
