import { describe, test, expect } from 'vitest';
import { isDirectoryEnabled, FEATURE_FLAGS } from '../src/lib/config/feature-flags';

describe('Feature Flags Enforcement (Master Prompt Rule 43 & 61)', () => {
  test('DIRECTORY_ENABLED must default to false', () => {
    // Unless explicitly set to 'true', directory feature flag MUST be false
    expect(FEATURE_FLAGS.DIRECTORY_ENABLED).toBe(false);
    expect(isDirectoryEnabled()).toBe(false);
  });
});
