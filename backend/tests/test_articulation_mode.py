"""Tests for per-item articulation mode feature (issue #31).

Tests cover:
- Model default values
- Migration v5 -> v6
- Selector respecting articulation_mode
- API routes for reading and updating articulation_mode
"""

from models import Arpeggio, Scale, Setting
from services.selector import generate_practice_set

# --- Model tests ---


def test_scale_default_articulation_mode(db):
    """Scale articulation_mode should default to 'both'."""
    scale = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(scale)
    db.commit()
    db.refresh(scale)
    assert scale.articulation_mode == "both"


def test_arpeggio_default_articulation_mode(db):
    """Arpeggio articulation_mode should default to 'both'."""
    arpeggio = Arpeggio(note="G", type="major", octaves=2, enabled=True)
    db.add(arpeggio)
    db.commit()
    db.refresh(arpeggio)
    assert arpeggio.articulation_mode == "both"


def test_scale_articulation_mode_values(db):
    """Scale should accept all valid articulation_mode values."""
    for mode in ("both", "separate_only", "slurred_only"):
        scale = Scale(note="C", type="major", octaves=2, enabled=True, articulation_mode=mode)
        db.add(scale)
        db.commit()
        db.refresh(scale)
        assert scale.articulation_mode == mode


def test_arpeggio_articulation_mode_values(db):
    """Arpeggio should accept all valid articulation_mode values."""
    for mode in ("both", "separate_only", "slurred_only"):
        arpeggio = Arpeggio(note="G", type="major", octaves=2, enabled=True, articulation_mode=mode)
        db.add(arpeggio)
        db.commit()
        db.refresh(arpeggio)
        assert arpeggio.articulation_mode == mode


# --- Migration tests ---


def test_migration_v5_to_v6(db):
    """Migration v5->v6 should add articulation_mode column to scales and arpeggios."""
    from sqlalchemy import inspect

    from services.migrations import migrate_v5_to_v6

    # First, drop the column if it exists (since create_all adds it)
    # We need to test that the migration handles the case where columns don't exist
    # The in-memory DB from conftest already has the columns from create_all,
    # so we'll just verify the migration is idempotent
    result = migrate_v5_to_v6(db)
    assert "columns_added" in result

    # Verify the columns exist after migration
    inspector = inspect(db.get_bind())
    scale_columns = {col["name"] for col in inspector.get_columns("scales")}
    arpeggio_columns = {col["name"] for col in inspector.get_columns("arpeggios")}
    assert "articulation_mode" in scale_columns
    assert "articulation_mode" in arpeggio_columns


def test_migration_v5_to_v6_idempotent(db):
    """Running migration v5->v6 twice should not error."""
    from services.migrations import migrate_v5_to_v6

    migrate_v5_to_v6(db)
    result2 = migrate_v5_to_v6(db)
    # Second run should add no columns since they already exist
    assert result2["columns_added"] == []


def test_run_migrations_includes_v6(db):
    """run_migrations should include v6 migration."""
    from services.migrations import CURRENT_SCHEMA_VERSION, MIGRATIONS

    assert CURRENT_SCHEMA_VERSION == 6
    assert 6 in MIGRATIONS
    assert "articulation_mode" in MIGRATIONS[6].lower()


# --- Selector tests ---


def test_selector_separate_only_always_separate(db):
    """Items with articulation_mode='separate_only' should always get 'separate'."""
    scale = Scale(
        note="C",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="separate_only",
    )
    db.add(scale)
    db.commit()

    # Run multiple times to confirm it's always separate
    for _ in range(10):
        items = generate_practice_set(db)
        assert len(items) > 0
        for item in items:
            assert item["articulation"] == "separate"


def test_selector_slurred_only_always_slurred(db):
    """Items with articulation_mode='slurred_only' should always get 'slurred'."""
    scale = Scale(
        note="C",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="slurred_only",
    )
    db.add(scale)
    db.commit()

    for _ in range(10):
        items = generate_practice_set(db)
        assert len(items) > 0
        for item in items:
            assert item["articulation"] == "slurred"


def test_selector_both_mode_uses_slurred_percent(db):
    """Items with articulation_mode='both' should use random slurred_percent."""
    scale = Scale(
        note="C", type="major", octaves=2, enabled=True, weight=1.0, articulation_mode="both"
    )
    db.add(scale)
    db.commit()

    # With slurred_percent=100, should always be slurred
    setting = Setting(
        key="selection_algorithm",
        value={"slurred_percent": 100, "total_items": 5},
    )
    db.add(setting)
    db.commit()

    items = generate_practice_set(db)
    for item in items:
        assert item["articulation"] == "slurred"


def test_selector_mixed_articulation_modes(db):
    """Mixed articulation modes: each item should get its correct mode."""
    s1 = Scale(
        note="C",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="separate_only",
    )
    s2 = Scale(
        note="D",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="slurred_only",
    )
    db.add_all([s1, s2])
    db.commit()

    items = generate_practice_set(db)
    for item in items:
        if item["id"] == s1.id:
            assert item["articulation"] == "separate"
        elif item["id"] == s2.id:
            assert item["articulation"] == "slurred"


def test_selector_item_data_includes_articulation_mode(db):
    """Practice set items should include articulation_mode."""
    scale = Scale(
        note="C",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="separate_only",
    )
    db.add(scale)
    db.commit()

    items = generate_practice_set(db)
    assert len(items) > 0
    for item in items:
        assert "articulation_mode" in item
        assert item["articulation_mode"] == "separate_only"


# --- Route tests: Scales ---


def test_get_scales_includes_articulation_mode(client, db):
    """GET /api/scales should include articulation_mode in response."""
    scale = Scale(
        note="C", type="major", octaves=2, enabled=True, articulation_mode="separate_only"
    )
    db.add(scale)
    db.commit()

    response = client.get("/api/scales")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["articulation_mode"] == "separate_only"


def test_get_scales_default_articulation_mode(client, db):
    """GET /api/scales should show 'both' as default articulation_mode."""
    scale = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(scale)
    db.commit()

    response = client.get("/api/scales")
    data = response.json()
    assert data[0]["articulation_mode"] == "both"


def test_update_scale_articulation_mode(client, db):
    """PUT /api/scales/{id} should allow updating articulation_mode."""
    scale = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(scale)
    db.commit()
    db.refresh(scale)

    response = client.put(
        f"/api/scales/{scale.id}",
        json={"articulation_mode": "separate_only"},
    )
    assert response.status_code == 200
    assert response.json()["articulation_mode"] == "separate_only"

    # Verify in DB
    db.refresh(scale)
    assert scale.articulation_mode == "separate_only"


def test_update_scale_articulation_mode_invalid(client, db):
    """PUT /api/scales/{id} should reject invalid articulation_mode values."""
    scale = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(scale)
    db.commit()
    db.refresh(scale)

    response = client.put(
        f"/api/scales/{scale.id}",
        json={"articulation_mode": "invalid_mode"},
    )
    assert response.status_code == 422


# --- Route tests: Arpeggios ---


def test_get_arpeggios_includes_articulation_mode(client, db):
    """GET /api/arpeggios should include articulation_mode in response."""
    arpeggio = Arpeggio(
        note="G", type="major", octaves=2, enabled=True, articulation_mode="slurred_only"
    )
    db.add(arpeggio)
    db.commit()

    response = client.get("/api/arpeggios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["articulation_mode"] == "slurred_only"


def test_update_arpeggio_articulation_mode(client, db):
    """PUT /api/arpeggios/{id} should allow updating articulation_mode."""
    arpeggio = Arpeggio(note="G", type="major", octaves=2, enabled=True)
    db.add(arpeggio)
    db.commit()
    db.refresh(arpeggio)

    response = client.put(
        f"/api/arpeggios/{arpeggio.id}",
        json={"articulation_mode": "slurred_only"},
    )
    assert response.status_code == 200
    assert response.json()["articulation_mode"] == "slurred_only"

    # Verify in DB
    db.refresh(arpeggio)
    assert arpeggio.articulation_mode == "slurred_only"


def test_update_arpeggio_articulation_mode_invalid(client, db):
    """PUT /api/arpeggios/{id} should reject invalid articulation_mode values."""
    arpeggio = Arpeggio(note="G", type="major", octaves=2, enabled=True)
    db.add(arpeggio)
    db.commit()
    db.refresh(arpeggio)

    response = client.put(
        f"/api/arpeggios/{arpeggio.id}",
        json={"articulation_mode": "invalid_mode"},
    )
    assert response.status_code == 422


# --- Generate set route test ---


def test_generate_set_respects_articulation_mode(client, db):
    """POST /api/generate-set should respect per-item articulation_mode."""
    scale = Scale(
        note="C",
        type="major",
        octaves=2,
        enabled=True,
        weight=1.0,
        articulation_mode="separate_only",
    )
    db.add(scale)
    db.commit()

    response = client.post("/api/generate-set")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for item in data["items"]:
        assert item["articulation"] == "separate"
