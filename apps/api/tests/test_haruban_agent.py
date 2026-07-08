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


def test_haruban_fallback_recommends_one_place_when_user_asks_for_one():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "intent": "recommend",
                "total_count": 77,
                "regions": ["seongsan"],
                "category": "food",
                "items": [
                    {
                        "name": "WORLD CLASS FISH&CHIPS",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "has_fix_request": False,
                    },
                    {
                        "name": "소심한이층",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "has_fix_request": False,
                    },
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "한 곳만" in reply
    assert "WORLD CLASS FISH&CHIPS" in reply
    assert "77곳" in reply
    assert "더 좁혀드릴까요" not in reply


def test_haruban_fallback_answers_place_detail_from_detail_tool():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "소심한 이층",
                "items": [
                    {
                        "name": "소심한이층",
                        "region": "seongsan",
                        "category": "food",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "source": "비짓제주",
                        "has_fix_request": False,
                        "check_required": ["operating", "public_data"],
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "소심한이층" in reply
    assert "성산" in reply
    assert "주소" in reply
    assert "영업시간" in reply
    assert "공공데이터 기준" in reply


def test_haruban_infers_detail_query_from_spaced_place_name():
    conv = [
        {
            "role": "assistant",
            "content": "먼저 해오름, WORLD CLASS FISH&CHIPS, 소심한이층 같은 후보를 볼 수 있어요.",
        },
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == "소심한이층"


def test_haruban_builds_search_pool_args_for_one_seafood_lunch():
    conv = [
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
        {"role": "assistant", "content": "조건을 조금 더 알려주세요."},
        {"role": "user", "content": "혼자이고 제주도에서 먹을 수 있는 해산물이면 좋겠어"},
    ]
    args = haruban._infer_search_places_args(conv, {
        "regions": ["seongsan"],
        "moments": ["local_food"],
        "companion": "solo",
    })

    assert args["regions"] == ["seongsan"]
    assert args["category"] == "food"
    assert args["intent"] == "recommend"
    assert args["limit"] == 1
    assert "해산물" in args["keywords"]


def test_haruban_does_not_treat_general_planning_as_place_detail():
    conv = [
        {"role": "user", "content": "제주는 처음인데 어떻게 여행계획을 세우면 좋을지 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    assert haruban._build_search_pool_context(conv, {}) is None


def test_haruban_does_not_treat_region_category_query_as_place_detail():
    conv = [
        {"role": "user", "content": "제주시에 있는 오름 정보를 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    args = haruban._infer_search_places_args(conv, {})
    assert args["regions"] == ["jeju_city"]
    assert args["category"] == "oreum"


def test_haruban_infers_beach_category_from_user_text():
    conv = [
        {"role": "user", "content": "제주시에 있는 바닷가 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    args = haruban._infer_search_places_args(conv, {})
    assert args["regions"] == ["jeju_city"]
    assert args["category"] == "beach"


def test_haruban_routes_broad_advice_to_free_gpt_path():
    assert haruban._should_answer_without_search([
        {"role": "user", "content": "제주는 처음인데 어떻게 여행계획을 세우면 좋을지 알려줘"},
    ])
    assert haruban._should_answer_without_search([
        {"role": "user", "content": "제주시는 어떤곳을 가보면 좋은지 알려줘"},
    ])
    assert not haruban._should_answer_without_search([
        {"role": "user", "content": "제주시에 있는 오름 정보를 알려줘"},
    ])
    assert not haruban._should_answer_without_search([
        {"role": "user", "content": "소심한이층에 관해 자세히 알려줘"},
    ])


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
