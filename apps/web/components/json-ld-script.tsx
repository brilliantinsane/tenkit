import type { Graph } from "schema-dts"

function serializeJsonLd(graph: Graph) {
  return JSON.stringify(graph).replaceAll("<", "\\u003c")
}

export function JsonLdScript({ graph, id }: { graph: Graph; id: string }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  )
}
