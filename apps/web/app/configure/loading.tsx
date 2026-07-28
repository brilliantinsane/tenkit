import { ConfigurePageLoading } from "@/components/configure-page-loading"
import { ConfigurePageShell } from "@/components/configure-page-shell"

export default function ConfigureRouteLoading() {
  return (
    <ConfigurePageShell>
      <ConfigurePageLoading />
    </ConfigurePageShell>
  )
}
