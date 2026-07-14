from pathlib import Path
import re

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


def test_contribution_ledger_tables_exist():
    for table in LEDGER_TABLES:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in SCHEMA


def test_contribution_ledger_has_explicit_domain_constraints():
    for column in (
        "role",
        "status",
        "visibility",
        "source_type",
        "source_class",
        "support_status",
        "visit_status",
        "moderation_status",
        "decision",
    ):
        assert re.search(rf"CHECK\s*\(\s*{column}\s+IN\s*\(", SCHEMA)


def test_plan_client_ids_are_idempotent():
    assert "UNIQUE (owner_id, client_plan_id)" in SCHEMA
    assert "UNIQUE (plan_id, client_item_id)" in SCHEMA


def test_public_data_correction_is_versioned_and_never_updates_place():
    correction_ddl = SCHEMA.split(
        "CREATE TABLE IF NOT EXISTS public_data_correction", 1
    )[1]

    assert "approved_by UUID" in correction_ddl
    assert "supersedes_id UUID" in correction_ddl
    assert "UPDATE place SET" not in correction_ddl


def test_schema_statements_remain_compatible_with_bootstrap_splitter():
    statements = _split_statements(SCHEMA)

    for table in LEDGER_TABLES:
        matching = [
            statement
            for statement in statements
            if statement.splitlines()[0] == f"CREATE TABLE IF NOT EXISTS {table} ("
        ]
        assert len(matching) == 1

    assert all("CREATE TABLE" not in statement[1:] for statement in statements)
