import json
import logging
from datetime import date
from types import SimpleNamespace

import openai

from apps.api.engine import haruban


def test_haruban_prompt_frames_web_research_agent():
    prompt = haruban._BASE_SYSTEM_PROMPT
    assert "gpt-5-mini" in prompt
    assert "도구" in prompt
    assert "total_count" in prompt
    assert "이전 대화 맥락" in prompt
    assert "웹 리서치" in prompt
    assert "공공데이터 교차확인" in prompt
    assert "저희 DB/RAG 검색 기준" not in prompt


def test_haruban_prompt_uses_web_research_answer_contract():
    prompt = haruban._BASE_SYSTEM_PROMPT

    assert "카카오·네이버·블로그 리뷰를 근거로 삼지 마라" not in prompt
    assert "정보가 없으면 '저희가 참조하는 공공데이터 기준" not in prompt
    for phrase in ("직접 결론", "후보별", "비교", "주의", "출처", "공공데이터 교차확인"):
        assert phrase in prompt


def test_haruban_prompt_requires_scannable_markdown_answers():
    prompt = haruban._BASE_SYSTEM_PROMPT

    for phrase in ("Markdown", "## 한눈에 보기", "## 추천 장소", "## 방문 팁", "1,800자", "최대 6곳", "A/B/C/D", "반복하지"):
        assert phrase in prompt
    assert "답변 길이는 고정하지 않고" not in prompt


def test_search_places_tool_supports_count_questions():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "search_places")
    description = tool["function"]["description"]
    assert "몇 개" in description
    assert "총 개수" in description
    assert "공공데이터 근거" in description


def test_haruban_tools_include_unlocked_agent_capabilities():
    tool_names = {t["function"]["name"] for t in haruban.TOOLS}

    assert "build_pack" in tool_names
    assert "verify_review" in tool_names
    assert "preview_region_coverage" in tool_names
    assert "suggest_form_augment" in tool_names
    assert "web_search_jeju" in tool_names


def test_web_search_jeju_tool_requires_query_and_returns_sources():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "web_search_jeju")
    props = tool["function"]["parameters"]["properties"]

    assert "query" in props
    assert "sources" in tool["function"]["description"]
    assert "최신" in tool["function"]["description"]


def test_build_pack_tool_requires_form_state():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "build_pack")
    props = tool["function"]["parameters"]["properties"]

    assert "form_state" in props
    assert "여행팩" in tool["function"]["description"]
    assert "공공데이터" in tool["function"]["description"]


def test_haruban_build_pack_runner_summarizes_pack(monkeypatch):
    class FakeReq:
        regions = ["seongsan"]
        moments = ["local_food"]
        companion = "solo"
        purpose = "food"
        days = 2
        start_date = date(2026, 7, 10)

    class FakeFilterBundle:
        per_moment = ["fake-filter"]

    class FakeIntro:
        text = "성산 현지 맛집 중심으로 조립했어요."
        llm_used = False

    class FakeItem:
        name = "소심한이층"
        badge = "verified"
        note = ""
        address = "서귀포시 성산읍"

    class FakeSection:
        moment = "local_food"
        items = [FakeItem()]
        fallback = None
        observed_reasons = []

    monkeypatch.setattr(haruban.filters_mod.PackRequest, "from_dict", lambda _: FakeReq())
    monkeypatch.setattr(haruban.filters_mod, "build_filters", lambda _: FakeFilterBundle())
    monkeypatch.setattr(
        haruban.weather_mod,
        "smoke_kma_nowcast",
        lambda *a, **k: {"available": True, "summary": "바람 확인"},
    )
    monkeypatch.setattr(haruban.trust_mod, "judge_section", lambda *a, **k: FakeSection())
    monkeypatch.setattr(haruban.assemble_mod, "compose_intro", lambda *a, **k: FakeIntro())
    monkeypatch.setattr(
        haruban.assemble_mod,
        "dispatch_itinerary",
        lambda *a, **k: [{"day": 1, "items": []}],
    )

    result = haruban._run_build_pack({"form_state": {"regions": ["seongsan"]}})

    assert result["available"] is True
    assert result["intro"]["text"] == "성산 현지 맛집 중심으로 조립했어요."
    assert result["sections"][0]["items"][0]["name"] == "소심한이층"
    assert result["weather"]["summary"] == "바람 확인"


def test_haruban_verify_review_runner_serializes_claims(monkeypatch):
    class FakeClaim:
        text = "A 식당은 폐업했다."
        verdict = "contradicted"
        fallback_reason = "contradicted"
        matched_name = "A 식당"
        matched_external_id = "v1"
        reason = "수정요청에서 폐업 신호가 확인됩니다."
        sources = ["visitjeju"]

    monkeypatch.setattr(haruban.verify_mod, "verify_text", lambda text: [FakeClaim()])

    result = haruban._run_verify_review({"text": "A 식당은 폐업했다."})

    assert result["claims"][0]["verdict"] == "contradicted"
    assert result["claims"][0]["matched_name"] == "A 식당"
    assert result["claims"][0]["sources"] == ["visitjeju"]


def test_haruban_region_coverage_runner_handles_multiple_regions(monkeypatch):
    monkeypatch.setattr(
        haruban.region_coverage_mod,
        "build_region_preview",
        lambda region: {"region": region, "moments": [{"moment": "beach_walk", "count": 4}]},
    )

    result = haruban._run_preview_region_coverage({"regions": ["seongsan", "gujwa"]})

    assert [r["region"] for r in result["regions"]] == ["seongsan", "gujwa"]


def test_haruban_web_search_runner_serializes_sources(monkeypatch):
    class FakeWebResult:
        available = True
        answer = "제주시에서는 원도심 산책과 해안 드라이브를 함께 보기 좋습니다."
        sources = [
            {"title": "Visit Jeju", "url": "https://www.visitjeju.net/", "snippet": "제주시 여행 정보"},
        ]
        query = "제주시 요즘 가볼만한 곳"
        reason = ""

    monkeypatch.setattr(haruban, "_perform_web_search_jeju", lambda query, context="": FakeWebResult())

    result = haruban._run_web_search_jeju({
        "query": "제주시 요즘 가볼만한 곳",
        "context": "처음 제주",
    })

    assert result["available"] is True
    assert result["source_type"] == "web"
    assert result["answer"].startswith("제주시")
    assert result["sources"][0]["url"] == "https://www.visitjeju.net/"


def test_build_web_search_plan_covers_source_roles():
    plan = haruban._build_web_search_plan("구좌 맛집 추천", "혼자 점심")

    assert 2 <= len(plan) <= 3
    assert {item["source_class"] for item in plan} >= {"official", "experience"}
    assert len({item["query"] for item in plan}) == len(plan)
    assert all("구좌" in item["query"] for item in plan)


def test_dedupe_sources_adds_class_and_checked_at():
    sources = haruban._dedupe_sources([
        {
            "title": "비짓제주",
            "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1",
        },
        {
            "title": "비짓제주 중복",
            "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1",
        },
    ])

    assert len(sources) == 1
    assert sources[0]["source_class"] == "official"
    assert sources[0]["checked_at"]


def test_web_source_classifier_marks_personal_publishing_hosts_as_experience():
    assert haruban._classify_web_source(
        "https://example.tistory.com/123",
        "제주 음식점 목록",
    ) == "experience"
    assert haruban._classify_web_source(
        "https://blog.naver.com/example/123",
        "제주 카페 후기",
    ) == "experience"
    assert haruban._classify_web_source(
        "https://www.siksinhot.com/P/458379",
        "제주 음식점 정보",
    ) == "platform"


def test_web_source_role_guardrail_replaces_universal_official_claim():
    reply = (
        "모두 공식 또는 공개 플랫폼을 통해 직접 확인된 사항만 정리했습니다.\n\n"
        "## 추천 장소\n**돈사돈**\n- 특징: 흑돼지 전문점입니다."
    )
    guarded = haruban._enforce_web_source_role_disclosure(
        reply,
        [
            {"url": "https://www.visitjeju.net/place", "source_class": "official"},
            {"url": "https://example.tistory.com/post", "source_class": "experience"},
        ],
    )

    assert "모두 공식 또는 공개 플랫폼" not in guarded
    assert "출처 구성: 공식 1건, 후기 1건" in guarded
    assert "방문 전 재확인" in guarded


def test_web_research_uses_one_builtin_search_for_original_question(monkeypatch):
    calls = []

    def fake_single(query, context="", source_class="web", timeout_seconds=None):
        calls.append((query, context, source_class, timeout_seconds))
        return haruban.WebSearchResult(
            available=True,
            query=query,
            answer="성산 맛집을 웹에서 확인했습니다.",
            sources=[{"title": "성산 안내", "url": "https://example.com/seongsan"}],
            research_status="sufficient",
        )

    monkeypatch.setattr(haruban, "_perform_single_web_search", fake_single, raising=False)

    result = haruban._perform_web_search_jeju("성산의 맛집들은?", context="혼자 여행")

    assert result.available is True
    assert result.research_status == "sufficient"
    assert calls == [(
        "성산의 맛집들은?",
        "혼자 여행",
        "web",
        haruban.WEB_SEARCH_TIMEOUT_SECONDS,
    )]
    assert result.queries == ["성산의 맛집들은?"]


def test_extract_response_sources_supports_dict_url_citations():
    response = SimpleNamespace(output=[{
        "type": "message",
        "content": [{
            "type": "output_text",
            "text": "성산 맛집 안내",
            "annotations": [{
                "type": "url_citation",
                "url": "https://example.com/restaurant",
                "title": "성산 식당",
                "start_index": 0,
                "end_index": 6,
            }],
        }],
    }])

    sources = haruban._extract_response_sources(response)

    assert sources[0]["url"] == "https://example.com/restaurant"
    assert sources[0]["title"] == "성산 식당"


def test_single_web_search_forces_search_with_explicit_jeju_region_context(monkeypatch):
    captured = {}
    response = SimpleNamespace(
        output_text="성산읍 맛집을 웹에서 확인했습니다.",
        output=[{
            "type": "message",
            "content": [{
                "type": "output_text",
                "text": "성산읍 맛집을 웹에서 확인했습니다.",
                "annotations": [{
                    "type": "url_citation",
                    "url": "https://example.com/seongsan-food",
                    "title": "성산읍 맛집",
                }],
            }],
        }],
    )

    class FakeResponses:
        @staticmethod
        def create(**kwargs):
            captured.update(kwargs)
            return response

    monkeypatch.setattr(
        openai,
        "OpenAI",
        lambda **_kwargs: SimpleNamespace(responses=FakeResponses()),
    )
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    result = haruban._perform_single_web_search(
        "성산의 맛집들은?",
        context='{"regions": ["seongsan"]}',
    )

    assert result.available is True
    assert captured["tool_choice"] == "required"
    assert captured["model"] == haruban.WEB_SEARCH_MODEL
    assert haruban.WEB_SEARCH_MODEL == "gpt-4o"
    assert captured["max_tool_calls"] == 1
    assert "reasoning" not in captured
    assert captured["max_output_tokens"] == haruban.WEB_SEARCH_MAX_OUTPUT_TOKENS
    assert haruban.WEB_SEARCH_MAX_OUTPUT_TOKENS == 2200
    assert "제주특별자치도 서귀포시 성산읍" in captured["input"]
    assert "되묻지" in captured["input"]
    assert "Markdown" in captured["input"]
    assert "## 한눈에 보기" in captured["input"]
    assert "1,800자" in captured["input"]
    assert "최대 6곳" in captured["input"]
    assert "A/B/C/D" in captured["input"]
    assert "정확한 상호명 또는 고유명만" in captured["input"]
    assert "운영시간·휴무·가격·예약·1인 주문 가능 여부" in captured["input"]
    assert "블로그·후기는 분위기와 방문 경험" in captured["input"]


def test_single_web_search_limits_timeout_and_logs_failure(monkeypatch, caplog):
    captured = {}

    class FakeResponses:
        @staticmethod
        def create(**kwargs):
            raise RuntimeError("provider timeout")

    def fake_openai(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(responses=FakeResponses())

    monkeypatch.setattr(openai, "OpenAI", fake_openai)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    caplog.set_level(logging.WARNING, logger=haruban.__name__)

    result = haruban._perform_single_web_search("구좌 오름 공식", source_class="official")

    assert result.available is False
    assert haruban.WEB_SEARCH_TIMEOUT_SECONDS == 18.0
    assert captured["timeout"] == haruban.WEB_SEARCH_TIMEOUT_SECONDS
    assert captured["max_retries"] == 0
    assert "provider timeout" in caplog.text
    assert "official" in caplog.text
    assert "model=gpt-4o" in caplog.text
    assert "timeout_seconds=18.0" in caplog.text
    assert "elapsed_ms" in caplog.text


def test_chat_turn_logs_total_latency(monkeypatch, caplog):
    monkeypatch.setattr(haruban, "_try_general_question_answer", lambda _messages: "바로 답변합니다.")
    caplog.set_level(logging.INFO, logger=haruban.__name__)

    turn = haruban.chat_turn(
        [{"role": "user", "content": "제주 여행 준비는 어떻게 시작해?"}],
        {},
    )

    assert turn.available is True
    assert "바로 답변" in turn.reply_text
    assert "haruban chat_turn completed" in caplog.text
    assert "elapsed_ms" in caplog.text


def test_preloaded_search_pool_disables_duplicate_model_tool_calls(monkeypatch):
    captured = {}
    message = SimpleNamespace(content="확인한 웹 근거를 정리했습니다.", tool_calls=[])
    response = SimpleNamespace(choices=[SimpleNamespace(message=message)])

    class FakeCompletions:
        @staticmethod
        def create(**kwargs):
            captured.update(kwargs)
            return response

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions()),
    )
    monkeypatch.setattr(openai, "OpenAI", lambda **kwargs: fake_client)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    turn = haruban._chat_turn_raw(
        [{"role": "system", "content": "웹 검색 결과가 이미 제공됨"}],
        [{"tool": "preload:web_search_jeju", "args": {}, "result_size": 10}],
        3,
        {},
        preloaded_tool="web_search_jeju",
    )

    assert turn.available is True
    assert captured["tools"] == []
    assert captured["tool_choice"] == "none"
    assert captured["reasoning_effort"] == "low"


def test_preloaded_web_answer_applies_source_role_guardrail(monkeypatch):
    message = SimpleNamespace(
        content=(
            "모두 공식 또는 공개 플랫폼에서 확인했습니다.\n\n"
            "## 추천 장소\n**돈사돈**\n- 특징: 흑돼지 전문점입니다."
        ),
        tool_calls=[],
    )
    response = SimpleNamespace(choices=[SimpleNamespace(message=message)])

    class FakeCompletions:
        @staticmethod
        def create(**_kwargs):
            return response

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions()),
    )
    monkeypatch.setattr(openai, "OpenAI", lambda **_kwargs: fake_client)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    conv = [{
        "role": "system",
        "content": haruban._format_search_pool_context({
            "tool": "web_search_jeju",
            "result": {
                "sources": [
                    {"url": "https://www.visitjeju.net/place", "source_class": "official"},
                    {"url": "https://example.tistory.com/post", "source_class": "experience"},
                ],
            },
        }),
    }]

    turn = haruban._chat_turn_raw(
        conv,
        [{"tool": "preload:web_search_jeju", "args": {}, "result_size": 10}],
        3,
        {},
        preloaded_tool="web_search_jeju",
    )

    assert "모두 공식 또는 공개 플랫폼" not in turn.reply_text
    assert "출처 구성: 공식 1건, 후기 1건" in turn.reply_text


def test_haruban_routes_fresh_broad_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "요즘 제주시 여행은 원도심과 바다 산책을 같이 보기 좋습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주가 처음인데 요즘 제주시의 가볼만한 곳들은?"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert "요즘" in result["args"]["query"]
    assert result["result"]["sources"][0]["title"] == "Visit Jeju"


def test_web_failure_fallback_does_not_substitute_public_data_candidates():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌에서 가장 맛집은?"},
        {
            "role": "tool",
            "name": "web_search_jeju",
            "content": json.dumps({
                "available": False,
                "research_status": "unavailable",
                "reason": "web search returned no usable source",
                "sources": [],
            }, ensure_ascii=False),
        },
    ])

    assert "웹 출처" in reply
    assert "여러 관점" not in reply
    assert "지역이나 순간을 하나 고르면" not in reply
    assert "공공데이터 후보" not in reply


def test_generic_fallback_does_not_default_to_public_data_mode():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌 여행을 더 알아보고 싶어"},
    ])

    assert "공공데이터 기준으로 다시 좁혀" not in reply
    assert "웹" in reply


def test_partial_web_fallback_discloses_partial_result_and_source_role():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌 오름을 알려줘"},
        {
            "role": "tool",
            "name": "web_search_jeju",
            "content": json.dumps({
                "available": True,
                "research_status": "partial",
                "answer": "공식 출처에서 구좌 오름 한 곳을 확인했습니다.",
                "sources": [{
                    "title": "제주 안내",
                    "url": "https://example.go.kr/oreum",
                    "source_class": "official",
                }],
            }, ensure_ascii=False),
        },
    ])

    assert "일부" in reply
    assert "공식" in reply
    assert reply.count("https://example.go.kr/oreum") == 1


def test_haruban_keeps_web_intent_for_oreum_followup(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "구좌 오름을 웹 출처로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌의 오름들 정보는?"},
    ]

    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "오름" in result["args"]["query"]


def test_haruban_keeps_web_intent_for_restaurant_followup(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "구좌 맛집을 웹 출처로 확인했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/gujwa"}],
            "source_type": "web",
        },
    )
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌에서 가장 맛집은?"},
    ]

    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "맛집" in result["args"]["query"]


def test_haruban_routes_direct_restaurant_recommendation_to_web(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"


def test_explicit_public_data_request_still_routes_to_search_places(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_search_places",
        lambda args: {
            "intent": args.get("intent"),
            "total_count": 2,
            "regions": args.get("regions"),
            "category": args.get("category"),
            "items": [{"name": "안돌오름", "address": "제주시 구좌읍"}],
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "공공데이터 기준으로 구좌 오름 후보 수를 알려줘"}],
        {},
    )

    assert result["tool"] == "search_places"


def test_haruban_routes_airport_region_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주공항은 제주시 용담동 일대에 있습니다.",
            "sources": [{"title": "한국공항공사", "url": "https://www.airport.co.kr/jeju/"}],
            "source_type": "web",
        },
    )
    conv = [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}]

    assert haruban._infer_place_detail_query(conv) == ""
    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "제주공항" in result["args"]["query"]
    assert result["result"]["sources"][0]["title"] == "한국공항공사"


def test_haruban_answers_airport_region_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}],
        {},
    )

    assert result.available is True
    assert "제주시" in result.reply_text
    assert "공항" in result.reply_text
    assert "호텔" not in result.reply_text
    assert "웹에서 바로 확인" not in result.reply_text


def test_haruban_answers_first_jeju_region_guide_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주는 처음인데 어떤 지역이 좋아?"}],
        {},
    )

    assert result.available is True
    assert "제주시" in result.reply_text
    assert "성산" in result.reply_text
    assert "애월" in result.reply_text
    assert "공공데이터" in result.reply_text


def test_haruban_answers_broad_jeju_city_guide_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주시를 처음 보면 어떤 흐름이 좋아?"}],
        {},
    )

    assert result.available is True
    assert "공항" in result.reply_text
    assert "원도심" in result.reply_text
    assert "장소" in result.reply_text


def test_haruban_general_question_router_sends_place_recommendations_to_web(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집 한 곳을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert "웹 출처" in result.reply_text
    assert "공공데이터 기준 후보" not in result.reply_text


def test_haruban_general_question_has_answer_contract(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}],
        {},
    )

    assert result.answer_contract == {
        "answer_type": "general_knowledge",
        "source_type": "stable_general",
        "confidence": "medium",
        "requires_tool": False,
        "limitations": ["장소·운영시간·요금은 별도 근거 확인 필요"],
    }


def test_haruban_search_pool_contract_for_weather(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_weather_signal",
        lambda form_state: {"available": True, "region_label": "제주시", "labels": ["비 확인"]},
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "여행 기간 날씨는 어때?"}],
        {"regions": ["jeju_city"]},
    )

    assert result["contract"]["answer_type"] == "weather"
    assert result["contract"]["source_type"] == "kma_weather"
    assert result["contract"]["requires_tool"] is True


def test_haruban_search_pool_contract_for_place_recommendation(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["contract"]["answer_type"] == "fresh_web"
    assert result["contract"]["source_type"] == "web"


def test_haruban_search_pool_contract_for_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "answer": "이번 주 제주 축제는 웹 출처로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "이번 주 제주 축제 알려줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["contract"]["answer_type"] == "fresh_web"
    assert result["contract"]["source_type"] == "web"


def test_haruban_augment_runner_serializes_suggestions(monkeypatch):
    class FakeSuggestion:
        field = "moments"
        kind = "add"
        values = ["beach_walk"]
        labels = ["바다 산책"]
        reason = "성산에서 확인된 후보가 많습니다."
        counts = {"beach_walk": 4}

    class FakeResult:
        available = True
        suggestions = [FakeSuggestion()]
        llm_used = False
        reason = ""

    monkeypatch.setattr(haruban.augment_mod, "build_augment", lambda form_state: FakeResult())

    result = haruban._run_suggest_form_augment({"form_state": {"regions": ["seongsan"]}})

    assert result["suggestions"][0]["field"] == "moments"
    assert result["suggestions"][0]["values"] == ["beach_walk"]


def test_haruban_builds_pack_tool_pool_for_pack_request(monkeypatch):
    called = {}

    def fake_build_pack(args):
        called.update(args)
        return {"available": True, "sections": []}

    monkeypatch.setattr(haruban, "_run_build_pack", fake_build_pack)

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "이 조건으로 팩 만들어줘"}],
        {"regions": ["seongsan"], "moments": ["local_food"], "days": 2},
    )

    assert result["tool"] == "build_pack"
    assert called["form_state"]["regions"] == ["seongsan"]


def test_haruban_routes_review_question_to_verify_review(monkeypatch):
    monkeypatch.setattr(haruban, "_run_verify_review", lambda args: {"claims": []})

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "블로그에서 봤는데 이 리뷰 맞아? 성산 A는 폐업했다."}],
        {},
    )

    assert result["tool"] == "verify_review"


def test_haruban_routes_region_overview_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 가볼만한 곳은 웹 출처 기준으로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시의 가볼만한 곳들ㅇ느?"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["result"]["sources"][0]["title"] == "Visit Jeju"
    assert "제주시" in result["args"]["query"]


def test_haruban_fallback_replies_from_build_pack_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "build_pack",
            "content": json.dumps({
                "available": True,
                "intro": {"text": "성산 현지 맛집 중심으로 조립했어요."},
                "sections": [
                    {
                        "moment": "local_food",
                        "items": [{"name": "소심한이층", "badge": "verified"}],
                        "fallback": None,
                    }
                ],
                "weather": {"summary": "바람 확인"},
            }, ensure_ascii=False),
        }
    ])

    assert "성산 현지 맛집" in reply
    assert "소심한이층" in reply
    assert "바람 확인" in reply


def test_haruban_fallback_replies_from_verify_review_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "verify_review",
            "content": json.dumps({
                "claims": [
                    {
                        "text": "A는 폐업했다.",
                        "verdict": "contradicted",
                        "fallback_reason": "contradicted",
                        "matched_name": "A",
                        "reason": "폐업 신호가 확인됩니다.",
                    }
                ],
            }, ensure_ascii=False),
        }
    ])

    assert "A는 폐업했다" in reply
    assert "폐업 신호" in reply
    assert "공공데이터 기준" in reply


def test_haruban_fallback_replies_from_region_coverage_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "제주시의 가볼만한 곳들ㅇ느?"},
        {
            "role": "tool",
            "name": "preview_region_coverage",
            "content": json.dumps({
                "regions": [
                    {
                        "region": "jeju_city",
                        "region_label": "제주시",
                        "briefing": "제주시는 바다 산책·현지 맛집 쪽 후보가 비교적 확인되어 있습니다.",
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "제주시" in reply
    assert "바다 산책" in reply
    assert "현지 맛집" in reply
    assert "조건을 조금 더 확인" not in reply


def test_haruban_prepares_args_for_direct_unlocked_tool_calls():
    conv = [{"role": "user", "content": "블로그에서 봤는데 이 리뷰 맞아? 성산 A는 폐업했다."}]
    form_state = {"regions": ["seongsan"], "moments": ["local_food"], "days": 2}

    build_args = haruban._prepare_tool_args("build_pack", {}, conv, form_state)
    verify_args = haruban._prepare_tool_args("verify_review", {}, conv, form_state)
    coverage_args = haruban._prepare_tool_args("preview_region_coverage", {}, conv, form_state)
    augment_args = haruban._prepare_tool_args("suggest_form_augment", {}, conv, form_state)

    assert build_args["form_state"]["regions"] == ["seongsan"]
    assert verify_args["text"].startswith("블로그에서 봤는데")
    assert coverage_args["regions"] == ["seongsan"]
    assert augment_args["form_state"]["moments"] == ["local_food"]


def test_haruban_infers_visitjeju_expanded_categories():
    assert haruban._infer_category_from_text("한림 숙박시설 알려줘") == "accommodation"
    assert haruban._infer_category_from_text("이번 여행 기간 축제 행사 알려줘") == "festival"
    assert haruban._infer_category_from_text("비 오는 날 실내 전시 알려줘") == "culture"
    assert haruban._infer_category_from_text("기념품 쇼핑 알려줘") == "shopping"
    assert haruban._infer_category_from_text("감귤 체험 알려줘") == "experience"


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


def test_haruban_one_pick_request_overrides_previous_three_count():
    conv = [
        {"role": "user", "content": "성산의 맛집들을 3곳을 알려줘"},
        {"role": "assistant", "content": "먼저 해오름, WORLD CLASS FISH&CHIPS, 소심한이층 같은 후보를 볼 수 있어요."},
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
    ]

    args = haruban._infer_search_places_args(conv, {})

    assert args["regions"] == ["seongsan"]
    assert args["category"] == "food"
    assert args["intent"] == "recommend"
    assert args["limit"] == 1


def test_haruban_detects_detail_query_from_plain_previous_candidate_list():
    conv = [
        {"role": "assistant", "content": "해오름, WORLD CLASS FISH&CHIPS, 소심한이층 후보가 있어요."},
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == "소심한이층"


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


def test_haruban_routes_first_place_to_visit_question_to_web_search(monkeypatch):
    captured = {}

    def fake_web_search(args):
        captured.update(args)
        return {
            "available": True,
            "query": args["query"],
            "answer": "제주시 첫 방문 후보를 웹 출처로 비교했습니다.",
            "sources": [{"title": "제주 관광 공식", "url": "https://example.com/jeju"}],
            "source_type": "web",
        }

    monkeypatch.setattr(haruban, "_run_web_search_jeju", fake_web_search)
    conv = [{"role": "user", "content": "제주시에서 제일 첫번째로 방문하면 좋은 곳을 알려줘"}]

    assert haruban._infer_place_detail_query(conv) == ""
    result = haruban._build_search_pool_context(conv, {"regions": ["jeju_city"]})

    assert result["tool"] == "web_search_jeju"
    assert captured["query"] == "제주시에서 제일 첫번째로 방문하면 좋은 곳을 알려줘"


def test_haruban_best_place_advice_cannot_bypass_web_research(monkeypatch):
    captured = {}

    def fake_web_search(args):
        captured.update(args)
        return {
            "available": True,
            "query": args["query"],
            "answer": "사용자 조건에 맞는 후보를 웹 출처로 비교했습니다.",
            "sources": [{"title": "제주 관광 공식", "url": "https://example.com/jeju"}],
            "source_type": "web",
        }

    monkeypatch.setattr(haruban, "_run_web_search_jeju", fake_web_search)
    conv = [{"role": "user", "content": "가장 가보면 좋은 곳에 대한 정보를 알려줘"}]

    assert haruban._should_use_web_research(conv) is True
    assert haruban._should_answer_without_search(conv) is False
    result = haruban._build_search_pool_context(conv, {"regions": ["jeju_city"]})

    assert result["tool"] == "web_search_jeju"
    assert captured["query"] == "가장 가보면 좋은 곳에 대한 정보를 알려줘"


def test_haruban_routes_beach_existence_question_to_web_search(monkeypatch):
    captured = {}

    def fake_web_search(args):
        captured.update(args)
        return {
            "available": True,
            "query": args["query"],
            "answer": "성산의 해변 후보를 웹 출처로 확인했습니다.",
            "sources": [{"title": "제주 관광 공식", "url": "https://example.com/seongsan"}],
            "source_type": "web",
        }

    monkeypatch.setattr(haruban, "_run_web_search_jeju", fake_web_search)
    conv = [{"role": "user", "content": "성산에 바닷가가 있나?"}]

    result = haruban._build_search_pool_context(conv, {"regions": ["seongsan"]})

    assert result["tool"] == "web_search_jeju"
    assert captured["query"] == "성산에 바닷가가 있나?"


def test_haruban_does_not_retry_failed_web_search(monkeypatch):
    calls = []
    timeouts = []

    def fake_single(query, context="", source_class="web", timeout_seconds=None):
        calls.append((query, context, source_class))
        timeouts.append(timeout_seconds)
        return haruban.WebSearchResult(
            available=False,
            query=query,
            reason="web search returned no usable source",
        )

    monkeypatch.setattr(haruban, "_perform_single_web_search", fake_single)

    result = haruban._perform_web_search_jeju(
        "제주시에서 처음 방문하기 좋은 곳",
        context='{"regions":["jeju_city"],"companion":"solo"}',
    )

    assert result.available is False
    assert len(calls) == 1
    assert result.queries == [calls[0][0]]
    assert timeouts == [haruban.WEB_SEARCH_TIMEOUT_SECONDS]


def test_haruban_reuses_recent_successful_web_research(monkeypatch):
    calls = []

    def fake_search(query, context=""):
        calls.append((query, context))
        return haruban.WebSearchResult(
            available=True,
            query=query,
            answer="성산의 해변 후보를 웹 출처로 확인했습니다.",
            sources=[{"title": "제주 관광 공식", "url": "https://example.com/seongsan"}],
            queries=[query],
            research_status="sufficient",
        )

    haruban._WEB_SEARCH_CACHE.clear()
    monkeypatch.setattr(haruban, "_perform_web_search_jeju", fake_search)
    args = {
        "query": "성산에 바닷가가 있나?",
        "context": '{"regions":["seongsan"],"companion":"solo"}',
    }

    first = haruban._run_web_search_jeju(args)
    second = haruban._run_web_search_jeju(args)

    assert len(calls) == 1
    assert first == second


def test_haruban_extracts_structured_candidates_from_web_answer():
    answer = """
## 추천 장소
- **이호테우해변**
  - 특징: 공항에서 가까운 해변 산책지입니다.
  - 위치: 제주시 이호동.
  - [Visit Jeju](https://www.visitjeju.net/example-iho)
- **용두암**
  - 추천 이유: 짧은 해안 산책에 적합합니다.
  - [공식 안내](https://www.visitjeju.net/example-yongduam)
"""
    candidates = haruban._extract_web_place_candidates(
        answer,
        [
            {"title": "Visit Jeju", "url": "https://www.visitjeju.net/example-iho"},
            {"title": "공식 안내", "url": "https://www.visitjeju.net/example-yongduam"},
        ],
        "제주시 첫 방문 추천",
        '{"regions":["jeju_city"],"moments":["beach_walk"]}',
    )

    assert [candidate["name"] for candidate in candidates] == ["이호테우해변", "용두암"]
    assert candidates[0]["region"] == "jeju_city"
    assert candidates[0]["moment"] == "beach_walk"
    assert candidates[0]["source_url"] == "https://www.visitjeju.net/example-iho"
    assert "공항에서 가까운" in candidates[0]["note"]


def test_haruban_candidate_extraction_ignores_bold_price_outside_recommendations():
    answer = """
## 추천 장소
- **우진해장국**
  - 특징: 고사리해장국 전문점입니다.
  - 위치: 제주시 서사로.
  - [지도 정보](https://map.example.com/woojin)

## 방문 팁
- 평균 가격은 **1인 25,000원~35,000원** 정도입니다.
  - [가격 참고](https://example.tistory.com/price)
"""
    candidates = haruban._extract_web_place_candidates(
        answer,
        [
            {"title": "지도 정보", "url": "https://map.example.com/woojin"},
            {"title": "가격 참고", "url": "https://example.tistory.com/price"},
        ],
        "제주시 맛집",
        '{"regions":["jeju_city"],"moments":["local_food"]}',
    )

    assert [candidate["name"] for candidate in candidates] == ["우진해장국"]


def test_haruban_candidate_extraction_requires_structured_place_fields():
    answer = """
## 추천 장소
- **후기 기반 참고 후보**
  - [블로그](https://example.tistory.com/list)
"""
    candidates = haruban._extract_web_place_candidates(
        answer,
        [{"title": "블로그", "url": "https://example.tistory.com/list"}],
        "제주시 맛집",
        '{"regions":["jeju_city"],"moments":["local_food"]}',
    )

    assert candidates == []


def test_haruban_candidate_extraction_accepts_bold_section_and_bullet_dot():
    answer = """
**추천 장소**
**자매국수**
• 특징: 고기국수 전문점입니다. ([**TripPick**](https://trippick.co/food))
• 위치: 제주시 항골남길 46

**우진해장국**
• 특징: 고사리육개장 전문입니다. ([**Visit Jeju**](https://visitjeju.net/place))
• 위치: 제주시 서사로 11

**방문 팁**
운영 정보는 방문 전 다시 확인합니다.
"""
    candidates = haruban._extract_web_place_candidates(
        answer,
        [
            {"title": "TripPick", "url": "https://trippick.co/food", "source_class": "web"},
            {
                "title": "Visit Jeju",
                "url": "https://visitjeju.net/place",
                "source_class": "official",
            },
        ],
        "최근 제주시 맛집들 알려줘",
        '{"regions":["jeju_city"],"moments":["local_food"]}',
    )

    assert [candidate["name"] for candidate in candidates] == ["자매국수", "우진해장국"]
    assert candidates[0]["source_url"] == "https://trippick.co/food"
    assert candidates[1]["source_url"] == "https://visitjeju.net/place"
    assert all(candidate["name"] not in {"TripPick", "Visit Jeju"} for candidate in candidates)


def test_haruban_candidate_extraction_accepts_field_labels_without_colons():
    answer = """
## 추천 장소
- **올래국수 본점**
  - 특징 및 추천 이유
    - 고기국수 중심의 식당입니다. ([**식신**](https://siksinhot.com/olle))
  - 위치
    - 제주시 귀아랑길 24

## 방문 팁
- 운영 정보는 방문 전 다시 확인합니다.
"""
    candidates = haruban._extract_web_place_candidates(
        answer,
        [{"title": "식신", "url": "https://siksinhot.com/olle", "source_class": "platform"}],
        "최근 제주시 맛집들 알려줘",
        '{"regions":["jeju_city"],"moments":["local_food"]}',
    )

    assert [candidate["name"] for candidate in candidates] == ["올래국수 본점"]
    assert candidates[0]["source_url"] == "https://siksinhot.com/olle"


def test_haruban_turn_exposes_web_candidates_without_second_llm_call(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "## 추천 장소\n- **용두암**: 짧은 해안 산책",
            "sources": [{"title": "공식", "url": "https://example.com/yongduam"}],
            "place_candidates": [{
                "id": "web-abc",
                "name": "용두암",
                "region": "jeju_city",
                "moment": "beach_walk",
                "note": "짧은 해안 산책",
                "source_title": "공식",
                "source_url": "https://example.com/yongduam",
                "checked_at": "2026-07-13T00:00:00+00:00",
                "search_query": args["query"],
            }],
            "source_type": "web",
        },
    )

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주시에서 가볼 만한 곳 추천해줘"}],
        {"regions": ["jeju_city"], "moments": ["beach_walk"]},
    )

    assert result.available is True
    assert result.place_candidates[0]["name"] == "용두암"


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


def test_haruban_fallback_mentions_excluded_candidates():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "다인숯불갈비, 용담밭담은 제외하고 3곳 더 알려줘"},
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "intent": "list",
                "total_count": 493,
                "regions": ["jeju_city"],
                "category": "food",
                "excluded_names": ["다인숯불갈비", "용담밭담"],
                "items": [
                    {"name": "명당양과", "address": "제주시"},
                    {"name": "제주올레면옥 제주공항본점", "address": "제주시"},
                    {"name": "해오름", "address": "제주시"},
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "다인숯불갈비" in reply
    assert "용담밭담" in reply
    assert "빼고" in reply
    assert "명당양과" in reply
    assert "더 좁혀드릴까요" not in reply


def test_haruban_routes_fix_request_question_to_place_detail():
    conv = [{"role": "user", "content": "느지리오름 수정요청내역은 어떤거야?"}]

    assert haruban._infer_place_detail_query(conv) == "느지리오름"


def test_haruban_fallback_answers_fix_request_detail_honestly():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "느지리오름 수정요청내역은 어떤거야?"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "느지리오름",
                "items": [
                    {
                        "name": "느지리오름",
                        "region_label": "한림",
                        "category_label": "오름 산책",
                        "has_fix_request": True,
                        "fix_request": {
                            "status": "확인 필요",
                            "summary": "이용자 정보 수정요청 이력이 있어 방문 전 재확인이 필요한 후보입니다.",
                            "known_detail": "현재 연결된 공공데이터에는 수정요청의 세부 사유가 별도 필드로 분리되어 있지 않습니다.",
                            "check_items": ["운영시간", "주소/위치", "휴무·폐업 여부", "이동·주차 가능 여부"],
                        },
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "느지리오름" in reply
    assert "수정요청 이력" in reply
    assert "세부 사유" in reply
    assert "운영시간" in reply
    assert "후보는 공공데이터 기준" not in reply


def test_haruban_fallback_answers_transit_detail_from_place_detail():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "금능포구 주차장이나 정류소는 어때?"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "금능포구",
                "items": [
                    {
                        "name": "금능포구",
                        "region_label": "한림",
                        "category_label": "바다 산책",
                        "address": "제주시 한림읍",
                        "has_fix_request": False,
                        "transit": {
                            "parking": True,
                            "parking_count": 2,
                            "bus_walkable": True,
                            "parking_radius_km": 1.0,
                            "busstop_radius_km": 0.5,
                        },
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "금능포구" in reply
    assert "주차장 2곳" in reply
    assert "정류소" in reply
    assert "좌표 기준" in reply


def test_haruban_infers_transit_place_name_with_particles():
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "후포해변의 교통편을 알려줘"},
    ]) == "후포해변"
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "돔베낭길의 주차장이 있어?"},
    ]) == "돔베낭길"
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "금능포구 주차장이나 정류소는 어때?"},
    ]) == "금능포구"


def test_haruban_detail_query_does_not_inherit_form_moment_category(monkeypatch):
    captured = {}

    def fake_detail(args):
        captured.update(args)
        return {"query": args["query"], "items": []}

    monkeypatch.setattr(haruban, "_run_get_place_detail", fake_detail)

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "돔베낭길의 주차장이 있어?"}],
        {"regions": ["seogwipo"], "moments": ["climb_oreum"]},
    )

    assert result["tool"] == "get_place_detail"
    assert captured["query"] == "돔베낭길"
    assert captured["regions"] == ["seogwipo"]
    assert "category" not in captured


def test_haruban_fallback_answers_weather_signal_by_trip_days():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "여행 기간 날씨는 어때?"},
        {
            "role": "tool",
            "name": "weather_signal",
            "content": json.dumps({
                "region_label": "한림",
                "available": True,
                "labels": ["흐림", "바람 확인"],
                "daily_forecasts": [
                    {
                        "date_label": "7월 10일",
                        "forecast": {
                            "sky": "흐림",
                            "precipitation_probability": 30,
                            "temperature": 28,
                            "wind_speed": 4.8,
                        },
                    },
                    {
                        "date_label": "7월 11일",
                        "forecast": {
                            "sky": "맑음",
                            "precipitation_probability": 0,
                            "temperature": 29,
                            "wind_speed": 2.0,
                        },
                    },
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "한림" in reply
    assert "7월 10일" in reply
    assert "강수확률 30%" in reply
    assert "풍속 4.8m/s" in reply
