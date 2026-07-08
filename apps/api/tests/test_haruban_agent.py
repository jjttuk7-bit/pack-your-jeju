from apps.api.engine import haruban


def test_haruban_prompt_frames_gpt_5_mini_rag_agent():
    prompt = haruban._BASE_SYSTEM_PROMPT
    assert "gpt-5-mini" in prompt
    assert "RAG" in prompt
    assert "도구" in prompt
    assert "total_count" in prompt


def test_search_places_tool_supports_count_questions():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "search_places")
    description = tool["function"]["description"]
    assert "몇 개" in description
    assert "총 개수" in description
