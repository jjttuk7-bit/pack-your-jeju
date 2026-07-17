import { describe, expect, it } from 'vitest';

import {
  buildRegionMomentCombinations,
  combinationKey,
  countReviewedCombinations,
} from './regionMomentInspector';

describe('region moment inspector model', () => {
  it('builds combinations in region-major order', () => {
    expect(
      buildRegionMomentCombinations(
        ['hallim', 'gujwa'],
        ['oreum', 'beach_walk', 'quiet_cafe'],
      ),
    ).toEqual([
      { region: 'hallim', moment: 'oreum' },
      { region: 'hallim', moment: 'beach_walk' },
      { region: 'hallim', moment: 'quiet_cafe' },
      { region: 'gujwa', moment: 'oreum' },
      { region: 'gujwa', moment: 'beach_walk' },
      { region: 'gujwa', moment: 'quiet_cafe' },
    ]);
  });

  it('counts reviewed keys only when their combinations remain selected', () => {
    const combinations = buildRegionMomentCombinations(
      ['hallim'],
      ['oreum', 'beach_walk'],
    );
    const reviewedKeys = new Set([
      combinationKey('hallim', 'oreum'),
      combinationKey('gujwa', 'quiet_cafe'),
    ]);

    expect(countReviewedCombinations(combinations, reviewedKeys)).toBe(1);
  });

  it('creates a stable key from a region and moment', () => {
    expect(combinationKey('hallim', 'quiet_cafe')).toBe('hallim:quiet_cafe');
  });
});
