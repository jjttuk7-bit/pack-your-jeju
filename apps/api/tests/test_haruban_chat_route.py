from fastapi.testclient import TestClient

from apps.api import main
from apps.api.engine.haruban import HarubanTurn


client = TestClient(main.app)


def test_agent_chat_passes_bounded_conversation_state_to_engine(monkeypatch):
    captured = {}

    def fake_chat_turn(messages, form_state, **kwargs):
        captured["messages"] = messages
        captured["form_state"] = form_state
        captured.update(kwargs)
        return HarubanTurn(available=True, reply_text="확인했습니다.")

    monkeypatch.setattr(main.haruban_mod, "chat_turn", fake_chat_turn)
    response = client.post(
        "/agent/chat",
        json={
            "messages": [{"role": "user", "content": "거기는 왜 유명해?"}],
            "form_state": {"regions": ["andeok"]},
            "conversation_state": {
                "last_user_question": "안덕은 어떤 곳이야?",
                "last_research_query": "안덕은 어떤 곳이야?",
                "active_regions": ["andeok"],
                "active_place_names": ["산방산"],
                "shown_place_names": ["산방산"],
                "excluded_constraints": [],
                "web_research_active": True,
            },
        },
    )

    assert response.status_code == 200
    assert captured["conversation_state"]["last_research_query"] == "안덕은 어떤 곳이야?"
    assert captured["conversation_state"]["active_place_names"] == ["산방산"]
    assert captured["conversation_state"]["web_research_active"] is True
