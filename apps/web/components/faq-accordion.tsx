"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { trackDatabuddyEvent } from "@/lib/databuddy"

type FaqItem = {
  id: string
  question: string
  answer: string
}

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card/70 shadow-sm"
      onValueChange={(faqId) => {
        if (!faqId) {
          return
        }

        const item = items.find((item) => item.id === faqId)

        trackDatabuddyEvent("faq_opened", {
          faqId,
          question: item?.question,
        })
      }}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-base hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
