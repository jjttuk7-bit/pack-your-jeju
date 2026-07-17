import type { HarubanChatMessage } from './api';

export const HARUBAN_CHAT_HISTORY_LIMIT = 24;

export type HarubanHistoryEntry =
  | { kind: 'user'; content: string }
  | { kind: 'assistant'; content: string }
  | { kind: 'intro' };

export function buildHarubanChatHistory(
  entries: readonly HarubanHistoryEntry[],
): HarubanChatMessage[] {
  return entries
    .filter((entry): entry is Extract<HarubanHistoryEntry, { kind: 'user' | 'assistant' }> =>
      entry.kind === 'user' || entry.kind === 'assistant')
    .map((entry) => ({
      role: entry.kind,
      content: entry.content,
    }))
    .slice(-HARUBAN_CHAT_HISTORY_LIMIT);
}
