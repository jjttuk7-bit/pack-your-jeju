import re
from pathlib import Path

from apps.api.bootstrap import _split_statements


SCHEMA = (
    Path(__file__).resolve().parents[3] / "packages" / "schema" / "init.sql"
).read_text(encoding="utf-8")


LEDGER_TABLES = (
    "user_profile",
    "travel_plan",
    "plan_item",
    "evidence",
    "visit_feedback",
    "evidence_asset",
    "moderation_case",
    "moderation_decision",
    "place_trust_profile",
    "public_data_correction",
)

TABLE_FIELDS = {
    "user_profile": (
        "id", "auth_subject", "display_name", "role", "status", "created_at",
    ),
    "travel_plan": (
        "id", "owner_id", "owner_scope_id", "client_plan_id", "title", "start_date", "days",
        "regions", "companion", "purpose", "visibility", "created_at", "updated_at",
    ),
    "plan_item": (
        "id", "plan_id", "place_id", "client_item_id", "source_type",
        "source_snapshot", "day", "visit_date", "note", "created_at",
    ),
    "evidence": (
        "id", "place_id", "plan_item_id", "source_class", "claim_type",
        "claim_key", "claim_value", "url", "checked_at", "support_status",
        "payload", "created_at",
    ),
    "visit_feedback": (
        "id", "plan_item_id", "place_id", "author_id", "visit_status",
        "operation_status", "mismatch_types", "experience_tags", "memo",
        "submission_weight", "moderation_status", "created_at",
    ),
    "evidence_asset": (
        "id", "feedback_id", "owner_id", "asset_type", "storage_path",
        "verification_status", "redacted_at", "deleted_at", "created_at",
    ),
    "moderation_case": (
        "id", "place_id", "case_type", "claim_key", "status", "priority",
        "research_status", "opened_at", "updated_at",
    ),
    "moderation_decision": (
        "id", "case_id", "reviewer_id", "decision", "rationale",
        "evidence_ids", "supersedes_id", "created_at",
    ),
    "place_trust_profile": (
        "place_id", "identity_confidence", "operation_confidence",
        "freshness_status", "field_confidence", "reasons", "calculated_at",
    ),
    "public_data_correction": (
        "id", "place_id", "claim_key", "corrected_value", "decision_id",
        "approved_by", "effective_from", "supersedes_id", "revoked_at", "created_at",
    ),
}


def _table_ddl(table: str) -> str:
    prefix = f"CREATE TABLE IF NOT EXISTS {table} ("
    matches = [
        statement
        for statement in _split_statements(SCHEMA)
        if statement.splitlines()[0] == prefix
    ]
    assert len(matches) == 1
    return matches[0]


def _assert_check(table: str, column: str) -> None:
    assert re.search(rf"CHECK\s*\(\s*{column}\s+IN\s*\(", _table_ddl(table))


def _check_values(table: str, column: str) -> set[str]:
    match = re.search(
        rf"{column}\s+IN\s*\((.*?)\)",
        _table_ddl(table),
        re.DOTALL,
    )
    assert match is not None
    return set(re.findall(r"'([^']+)'", match.group(1)))


def test_contribution_ledger_tables_exist():
    for table in LEDGER_TABLES:
        assert _table_ddl(table)


def test_each_ledger_table_contains_its_contract_fields():
    for table, fields in TABLE_FIELDS.items():
        ddl = _table_ddl(table)
        for field in fields:
            assert re.search(rf"^\s*{field}\s+", ddl, re.MULTILINE), (table, field)


def test_contribution_ledger_has_explicit_domain_constraints():
    for table, column in (
        ("user_profile", "role"),
        ("user_profile", "status"),
        ("travel_plan", "visibility"),
        ("plan_item", "source_type"),
        ("evidence", "source_class"),
        ("evidence", "claim_type"),
        ("evidence", "support_status"),
        ("visit_feedback", "visit_status"),
        ("visit_feedback", "operation_status"),
        ("visit_feedback", "moderation_status"),
        ("evidence_asset", "asset_type"),
        ("evidence_asset", "verification_status"),
        ("moderation_case", "case_type"),
        ("moderation_case", "status"),
        ("moderation_case", "priority"),
        ("moderation_case", "research_status"),
        ("moderation_decision", "decision"),
        ("place_trust_profile", "freshness_status"),
    ):
        _assert_check(table, column)


def test_ledger_states_match_product_and_trust_engine_contracts():
    feedback = " ".join(_table_ddl("visit_feedback").split())

    assert _check_values("plan_item", "source_type") == {
        "public_data", "web_search", "user_input", "community_verified",
    }
    assert "submission_weight NUMERIC(4, 3) NOT NULL DEFAULT 1.000" in feedback
    assert "CHECK (submission_weight BETWEEN 0 AND 1.5)" in feedback
    assert _check_values("visit_feedback", "moderation_status") == {
        "collecting_signals", "needs_more_evidence", "under_review", "approved", "rejected",
    }
    assert _check_values("moderation_case", "research_status") == {
        "pending", "running", "sufficient", "partial", "conflicted", "unavailable",
    }
    assert _check_values("evidence", "support_status") == {
        "supported", "partially_supported", "conflicted", "inferred", "unsupported",
    }


def test_plan_client_ids_are_idempotent():
    assert "UNIQUE (owner_scope_id, client_plan_id)" in _table_ddl("travel_plan")
    assert "UNIQUE (plan_id, client_item_id)" in _table_ddl("plan_item")


def test_plan_scope_survives_user_anonymization():
    ddl = _table_ddl("travel_plan")
    assert "owner_scope_id UUID NOT NULL" in ddl
    assert "owner_id UUID REFERENCES user_profile(id) ON DELETE SET NULL" in ddl


def test_ledger_indexes_cover_primary_read_paths():
    index_statements = {
        " ".join(statement.split())
        for statement in _split_statements(SCHEMA)
        if statement.upper().startswith("CREATE INDEX")
    }

    assert any("ON travel_plan (owner_scope_id, updated_at DESC)" in s for s in index_statements)
    assert any("ON visit_feedback (place_id, created_at DESC)" in s for s in index_statements)
    assert any(
        "ON moderation_case (priority_rank DESC, opened_at)" in s
        and "WHERE status IN ('open', 'researching', 'review_pending')" in s
        for s in index_statements
    )
    assert any(
        "ON public_data_correction (place_id, claim_key, effective_from DESC)" in s
        and "WHERE revoked_at IS NULL" in s
        for s in index_statements
    )


def test_schema_does_not_add_place_updates_or_triggers():
    ledger_sql = SCHEMA.split("-- 플랜 피드백 근거 원장", 1)[1]
    assert re.search(r"UPDATE\s+(?:\w+\.)?place\s+SET", ledger_sql, re.IGNORECASE) is None
    assert re.search(r"CREATE\s+TRIGGER", ledger_sql, re.IGNORECASE) is None


def test_ledger_foreign_keys_preserve_records_and_anonymize_users():
    for table, reference in (
        ("plan_item", "plan_id UUID NOT NULL REFERENCES travel_plan(id) ON DELETE RESTRICT"),
        ("plan_item", "place_id BIGINT REFERENCES place(id) ON DELETE RESTRICT"),
        ("evidence", "place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT"),
        ("evidence", "plan_item_id UUID REFERENCES plan_item(id) ON DELETE RESTRICT"),
        ("visit_feedback", "plan_item_id UUID NOT NULL REFERENCES plan_item(id) ON DELETE RESTRICT"),
        ("visit_feedback", "place_id BIGINT REFERENCES place(id) ON DELETE RESTRICT"),
        ("evidence_asset", "feedback_id UUID NOT NULL REFERENCES visit_feedback(id) ON DELETE RESTRICT"),
        ("moderation_case", "place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT"),
        ("moderation_decision", "case_id UUID NOT NULL REFERENCES moderation_case(id) ON DELETE RESTRICT"),
        ("moderation_decision", "supersedes_id UUID REFERENCES moderation_decision(id) ON DELETE RESTRICT"),
        ("place_trust_profile", "place_id BIGINT PRIMARY KEY REFERENCES place(id) ON DELETE RESTRICT"),
        ("public_data_correction", "place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT"),
        ("public_data_correction", "decision_id UUID NOT NULL REFERENCES moderation_decision(id) ON DELETE RESTRICT"),
        ("public_data_correction", "supersedes_id UUID REFERENCES public_data_correction(id) ON DELETE RESTRICT"),
    ):
        assert reference in _table_ddl(table)

    for table, reference in (
        ("travel_plan", "owner_id UUID REFERENCES user_profile(id) ON DELETE SET NULL"),
        ("visit_feedback", "author_id UUID REFERENCES user_profile(id) ON DELETE SET NULL"),
        ("evidence_asset", "owner_id UUID REFERENCES user_profile(id) ON DELETE SET NULL"),
        ("moderation_decision", "reviewer_id UUID REFERENCES user_profile(id) ON DELETE SET NULL"),
        ("public_data_correction", "approved_by UUID REFERENCES user_profile(id) ON DELETE SET NULL"),
    ):
        assert reference in _table_ddl(table)


def test_public_data_correction_is_versioned_and_never_updates_place():
    correction_ddl = _table_ddl("public_data_correction")

    assert "approved_by UUID" in correction_ddl
    assert "supersedes_id UUID" in correction_ddl
    assert "UPDATE place SET" not in SCHEMA.split(
        "CREATE TABLE IF NOT EXISTS public_data_correction", 1
    )[1]


def test_schema_statements_remain_compatible_with_bootstrap_splitter():
    statements = _split_statements(SCHEMA)

    for table in LEDGER_TABLES:
        assert _table_ddl(table) in statements

    assert all("CREATE TABLE" not in statement[1:] for statement in statements)
