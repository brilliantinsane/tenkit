import Link from "next/link"

import { Button } from "@/components/ui/button"

export function ConfigureHeaderLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/configure">Configurator</Link>
    </Button>
  )
}
