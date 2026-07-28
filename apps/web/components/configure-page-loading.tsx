import { Skeleton } from "@/components/ui/skeleton"

function ChoiceCardsSkeleton() {
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-23 rounded-xl lg:h-35" />
      ))}
    </div>
  )
}

function CompactSectionSkeleton() {
  return (
    <section className="relative">
      <div className="flex min-h-[18.125rem] flex-col justify-between gap-6 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <ChoiceCardsSkeleton />
      </div>
    </section>
  )
}

function AppVariantsSectionSkeleton() {
  return (
    <section className="relative">
      <div className="flex flex-col gap-6 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-80" />
        </div>
        <div className="rounded-lg border bg-card/65 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
          <Skeleton className="mt-4 h-24 w-full rounded-md" />
        </div>
      </div>
    </section>
  )
}

function PackageManagerSectionSkeleton() {
  return (
    <section className="relative">
      <div className="flex flex-col justify-between gap-6 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <ChoiceCardsSkeleton />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </section>
  )
}

export function ConfigurePageLoading() {
  return (
    <div
      aria-busy="true"
      className="grid gap-4 p-4 sm:gap-8 sm:p-8 lg:grid-cols-2 lg:items-start"
      data-slot="configure-page-loading"
    >
      <span className="sr-only" role="status">
        Loading configurator
      </span>
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="flex min-h-[18.125rem] flex-col gap-5 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-px w-full rounded-none" />
          <Skeleton className="h-18 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-4 sm:gap-8">
        <CompactSectionSkeleton />
        <CompactSectionSkeleton />
        <AppVariantsSectionSkeleton />
        <PackageManagerSectionSkeleton />
      </div>
    </div>
  )
}
