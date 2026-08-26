import { assert, test } from 'vitest';

import {
  normalizeGeneratedStylingChoice,
  SUPPORTED_GENERATED_STYLING_CHOICES,
} from '@tenkit/types/styling-definitions';

test('exposes canonical Styling Choices and the Bare default', () => {
  assert.deepEqual(SUPPORTED_GENERATED_STYLING_CHOICES, ['bare', 'uniwind', 'unistyles']);
  assert.equal(normalizeGeneratedStylingChoice(undefined), 'bare');
  assert.equal(normalizeGeneratedStylingChoice('uniwind'), 'uniwind');
  assert.equal(normalizeGeneratedStylingChoice('unistyles'), 'unistyles');
  assert.throws(
    () => normalizeGeneratedStylingChoice('nativewind'),
    /Unsupported generated Styling Choice "nativewind".*Expected one of: bare, uniwind, unistyles/,
  );
});
