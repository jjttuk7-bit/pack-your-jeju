import type { MomentId, RegionId } from './types';

export interface RegionMomentCombination {
  region: RegionId;
  moment: MomentId;
}

export function combinationKey(region: RegionId, moment: MomentId): string {
  return `${region}:${moment}`;
}

export function buildRegionMomentCombinations(
  regions: readonly RegionId[],
  moments: readonly MomentId[],
): RegionMomentCombination[] {
  return regions.flatMap((region) =>
    moments.map((moment) => ({
      region,
      moment,
    })),
  );
}

export function countReviewedCombinations(
  combinations: readonly RegionMomentCombination[],
  reviewedKeys: ReadonlySet<string>,
): number {
  return combinations.filter(({ region, moment }) =>
    reviewedKeys.has(combinationKey(region, moment)),
  ).length;
}
