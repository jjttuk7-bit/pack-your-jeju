# Haruban Latency Design

## Goal

Reduce the first visible delay when Haruban answers questions that trigger web research, without removing the web-first trust policy.

## Context

Haruban currently performs an OpenAI `responses.create` call with the `web_search` tool before the final chat response. The web search client timeout is 60 seconds and can retry with an expanded query when no source is found. That keeps answers evidence-based, but it can make the UI feel stuck during a demo.

## Design

Use a faster demo-safe budget:

- Set `WEB_SEARCH_TIMEOUT_SECONDS` to 20 seconds.
- Reduce web search `max_output_tokens` from 4000 to 2200, keeping the prompt's "about 1,800 Korean characters" instruction aligned with the API budget.
- Add structured latency logs around:
  - `/agent/chat` total duration
  - search pool preload duration
  - single web search duration and success/failure
  - final chat completion duration

## Tradeoffs

This can return fewer web-search details when OpenAI search is slow, but the existing fallback path already avoids fabricating facts and can tell the user when source evidence is unavailable. For the contest demo, a bounded wait is better than a silent 60-second spinner.

## Validation

Update Haruban tests to assert the shorter timeout and output token budget. Add unit coverage for latency logging without making real OpenAI calls.
