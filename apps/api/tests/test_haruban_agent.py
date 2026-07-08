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


def test_haruban_extracts_previous_candidates_for_more_requests():
    conv = [
        {
            "role": "assistant",
            "content": (
                "제주시에서 현지 맛집 후보는 공공데이터 기준으로 493곳 확인됩니다. "
                "먼저 용담밭담, 시나르, 다인숯불갈비 같은 후보를 볼 수 있어요."
            ),
        },
        {"role": "user", "content": "3곳 이외에 3곳 더 알려줘"},
    ]

    assert haruban._conversation_exclude_names(conv) == [
        "용담밭담",
        "시나르",
        "다인숯불갈비",
    ]


def test_haruban_extracts_explicit_exclusions():
    conv = [
        {
            "role": "assistant",
            "content": "먼저 다인숯불갈비, 고집돌우럭 (제주공항점), 용담밭담 같은 후보를 볼 수 있어요.",
        },
        {"role": "user", "content": "다인숯불갈비, 용담밭담은 제외하고 3곳을 더 알려줘"},
    ]

    assert haruban._conversation_exclude_names(conv) == [
        "다인숯불갈비",
        "고집돌우럭 (제주공항점)",
        "용담밭담",
    ]


def test_haruban_fallback_answers_repetition_question():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "다인 숯불갈비는 왜 반복적으로 알려주는거야?"},
    ])

    assert "이전 후보" in reply
    assert "제외" in reply
    assert "다시" in reply
