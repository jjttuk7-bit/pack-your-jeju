import json
import logging

from apps.api.logging import log_contribution_event


def test_contribution_event_is_structured_and_redacts_secrets(caplog):
    with caplog.at_level(logging.INFO, logger="pack_your_jeju.events"):
        payload = log_contribution_event("moderation_case_opened", actor_id="u1", case_id="c1", access_token="secret")
    assert payload["case_id"] == "c1"
    assert "access_token" not in payload
    assert json.loads(caplog.records[-1].message)["event"] == "moderation_case_opened"
