import type { HarubanChatResponse, HarubanConversationState } from './api';

export type { HarubanConversationState } from './api';

interface ConversationStateUpdate {
  question: string;
  formState: Record<string, unknown>;
  response: HarubanChatResponse;
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function createInitialHarubanConversationState(): HarubanConversationState {
  return {
    last_user_question: '',
    last_research_query: '',
    active_regions: [],
    active_place_names: [],
    shown_place_names: [],
    excluded_constraints: [],
    web_research_active: false,
  };
}

export function updateHarubanConversationState(
  previous: HarubanConversationState,
  update: ConversationStateUpdate,
): HarubanConversationState {
  const traces = Array.isArray(update.response.tool_trace) ? update.response.tool_trace : [];
  const webTrace = [...traces].reverse().find((trace) =>
    String(trace?.tool || '').includes('web_search_jeju'));
  const researchQuery = String(webTrace?.args?.query || '').trim();
  const candidates = update.response.place_candidates ?? [];
  const candidateNames = unique(candidates.map((candidate) => candidate.name)).slice(0, 5);
  const formRegions = Array.isArray(update.formState.regions)
    ? update.formState.regions.filter((region): region is string => typeof region === 'string')
    : [];
  const candidateRegions = candidates.map((candidate) => candidate.region).filter(Boolean);
  const activeRegions = unique([...formRegions, ...candidateRegions]).slice(0, 8);
  const shownPlaceNames = unique([
    ...previous.shown_place_names,
    ...candidateNames,
  ]).slice(-40);
  const excludedConstraints = /빼|제외|말고/.test(update.question)
    ? unique([...previous.excluded_constraints, update.question]).slice(-10)
    : previous.excluded_constraints.slice(-10);
  const webResearchActive = Boolean(
    webTrace
    || update.response.answer_contract?.source_type === 'web',
  );

  return {
    last_user_question: update.question.slice(0, 500),
    last_research_query: (researchQuery || previous.last_research_query).slice(0, 500),
    active_regions: activeRegions.length > 0
      ? activeRegions
      : previous.active_regions.slice(0, 8),
    active_place_names: candidateNames.length > 0
      ? candidateNames
      : previous.active_place_names.slice(0, 5),
    shown_place_names: shownPlaceNames,
    excluded_constraints: excludedConstraints,
    web_research_active: webResearchActive || previous.web_research_active,
  };
}
