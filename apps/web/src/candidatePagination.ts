import type { CandidatePageResponse, SectionDto } from './types';

export function mergeCandidateSection(
  current: SectionDto,
  page: CandidatePageResponse,
): SectionDto {
  const seen = new Set(current.items.map((item) => item.external_id));
  const nextItems = page.items.filter((item) => !seen.has(item.external_id));
  const items = [...current.items, ...nextItems];
  return {
    ...current,
    items,
    total_count: page.total_count ?? current.total_count,
    shown_count: items.length,
    has_more: page.has_more,
    next_cursor: page.next_cursor,
  };
}

export function hasFinishedCandidateSection(section: SectionDto): boolean {
  return (
    section.total_count !== undefined &&
    !section.has_more &&
    section.items.length >= section.total_count
  );
}
