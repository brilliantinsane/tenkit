export const SUPPORTED_GENERATED_STYLING_CHOICES = ['bare', 'uniwind'] as const;

export type GeneratedStylingChoice = (typeof SUPPORTED_GENERATED_STYLING_CHOICES)[number];

function isGeneratedStylingChoice(value: string): value is GeneratedStylingChoice {
  return value === 'bare' || value === 'uniwind';
}

export function normalizeGeneratedStylingChoice(value: string | undefined): GeneratedStylingChoice {
  if (value === undefined) {
    return 'bare';
  }

  if (isGeneratedStylingChoice(value)) {
    return value;
  }

  throw new Error(
    `Unsupported generated Styling Choice ${JSON.stringify(value)}. Expected one of: ${SUPPORTED_GENERATED_STYLING_CHOICES.join(', ')}.`,
  );
}
