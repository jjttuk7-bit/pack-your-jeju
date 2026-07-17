import { describe, expect, it } from 'vitest';
import {
  createInitialHarubanConversationState,
  updateHarubanConversationState,
} from './harubanConversationState';
import type { HarubanChatResponse } from './api';

function response(
  query: string,
  names: string[],
  region = 'andeok',
): HarubanChatResponse {
  return {
    available: true,
    reply_text: '확인했습니다.',
    form_suggestion: null,
    reason: '',
    tool_trace: [{
      tool: 'preload:web_search_jeju',
      args: { query },
      result_size: 10,
    }],
    answer_contract: {
      answer_type: 'recommendation',
      source_type: 'web',
      confidence: 'medium',
      requires_tool: true,
      limitations: [],
    },
    place_candidates: names.map((name, index) => ({
      id: `${region}-${index}`,
      name,
      region,
      moment: 'nature',
      source_title: '공식 관광',
      source_url: 'https://example.com',
      checked_at: '2026-07-17',
      search_query: query,
    })),
  };
}

describe('HarubanConversationState', () => {
  it('accumulates bounded session context from questions and structured responses', () => {
    const initial = createInitialHarubanConversationState();
    const first = updateHarubanConversationState(initial, {
      question: '안덕은 어떤 곳이야?',
      formState: { regions: ['andeok'] },
      response: response('안덕은 어떤 곳이야?', ['산방산', '용머리해안']),
    });
    const second = updateHarubanConversationState(first, {
      question: '용머리해안은 빼고 다른 곳',
      formState: { regions: ['andeok'] },
      response: response('용머리해안은 빼고 안덕의 다른 곳', ['산방산', '카멜리아힐']),
    });

    expect(second.last_user_question).toBe('용머리해안은 빼고 다른 곳');
    expect(second.last_research_query).toBe('용머리해안은 빼고 안덕의 다른 곳');
    expect(second.active_regions).toEqual(['andeok']);
    expect(second.active_place_names).toEqual(['산방산', '카멜리아힐']);
    expect(second.shown_place_names).toEqual(['산방산', '용머리해안', '카멜리아힐']);
    expect(second.excluded_constraints).toEqual(['용머리해안은 빼고 다른 곳']);
    expect(second.web_research_active).toBe(true);
    expect(createInitialHarubanConversationState()).not.toBe(initial);
  });

  it('caps active, shown, excluded, and region collections', () => {
    let state = createInitialHarubanConversationState();
    for (let index = 0; index < 45; index += 1) {
      state = updateHarubanConversationState(state, {
        question: `후보-${index}은 빼줘`,
        formState: { regions: Array.from({ length: 10 }, (_, i) => `region-${i}`) },
        response: response(
          `검색-${index}`,
          Array.from({ length: 7 }, (_, i) => `장소-${index}-${i}`),
          `region-${index}`,
        ),
      });
    }

    expect(state.active_regions).toHaveLength(8);
    expect(state.active_place_names).toHaveLength(5);
    expect(state.shown_place_names).toHaveLength(40);
    expect(state.excluded_constraints).toHaveLength(10);
  });
});
