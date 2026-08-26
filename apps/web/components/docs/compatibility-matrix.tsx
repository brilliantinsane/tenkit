import {
  getDocsGeneratedAppOptionRows,
  type DocsGeneratedAppOptionRow,
} from "@/lib/docs-generated-app-options"

const HEADERS = ["Backend", "Auth", "Database", "ORM"] as const

function CompatibilityRow({ row }: { row: DocsGeneratedAppOptionRow }) {
  return (
    <tr>
      {row.values.map((value, index) => (
        <td
          className="border-b px-3 py-2 align-top text-sm whitespace-nowrap"
          key={`${row.id}-${HEADERS[index]}`}
        >
          <code>{value}</code>
        </td>
      ))}
    </tr>
  )
}

export function CompatibilityMatrix() {
  const rows = getDocsGeneratedAppOptionRows()

  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">
          The 32 supported Backend, Auth, Database, and ORM combinations.
        </caption>
        <thead className="bg-muted/60">
          <tr>
            {HEADERS.map((header) => (
              <th
                className="border-b px-3 py-2 text-xs font-semibold tracking-wide uppercase"
                key={header}
                scope="col"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CompatibilityRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
