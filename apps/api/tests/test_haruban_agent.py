import json

from apps.api.engine import haruban


def test_haruban_prompt_frames_gpt_5_mini_rag_agent():
    prompt = haruban._BASE_SYSTEM_PROMPT
    assert "gpt-5-mini" in prompt
    assert "RAG" in prompt
    assert "도구" in prompt
    assert "total_count" in prompt
    assert "사용자의 자연어 질문을 먼저 이해" in prompt
    assert "제주를 담다가 확인한 공공데이터 기준" in prompt
    assert "저희 DB/RAG 검색 기준" not in prompt


def test_search_places_tool_supports_count_questions():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "search_places")
    description = tool["function"]["description"]
    assert "몇 개" in description
    assert "총 개수" in description
    assert "공공데이터 근거" in description


def test_haruban_fallback_reply_from_search_tool_is_user_facing():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "total_count": 3,
                "regions": ["hallim"],
                "category": "place",
                "items": [
                    {"name": "금오름", "address": "제주시 한림읍"},
                    {"name": "느지리오름", "address": "제주시 한림읍"},
                ],
            }, ensure_ascii=False),
        }
    ])

    assert "한림" in reply
    assert "3곳" in reply
    assert "금오름" in reply
    assert "공공데이터 기준" in reply
    assert "DB/RAG" not in reply
