import { describe, expect, it } from 'vitest';
import {
  HARUBAN_CHAT_HISTORY_LIMIT,
  buildHarubanChatHistory,
  type HarubanHistoryEntry,
} from './harubanChatHistory';

describe('buildHarubanChatHistory', () => {
  it('keeps the latest 24 user and assistant messages in chronological order', () => {
    const messages: HarubanHistoryEntry[] = Array.from({ length: 31 }, (_, index) => ({
      kind: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}`,
    }));
    const entries: HarubanHistoryEntry[] = [
      { kind: 'intro' },
      ...messages.slice(0, 10),
      { kind: 'intro' },
      ...messages.slice(10),
    ];

    const history = buildHarubanChatHistory(entries);

    expect(HARUBAN_CHAT_HISTORY_LIMIT).toBe(24);
    expect(history).toHaveLength(24);
    expect(history[0]).toEqual({ role: 'assistant', content: 'message-7' });
    expect(history[23]).toEqual({ role: 'user', content: 'message-30' });
    expect(history.some((message) => message.content === '')).toBe(false);
  });
});
