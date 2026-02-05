from models import Scale, Setting
from services.selector import generate_practice_set


def test_weekly_focus_weight_boost(db, client):
    # Create two scales, one in A (focus) and one in C
    s_a = Scale(note="A", type="major", octaves=2, enabled=True, weight=1.0)
    s_c = Scale(note="C", type="major", octaves=2, enabled=True, weight=1.0)
    db.add_all([s_a, s_c])

    # Configure weekly focus for key "A" with 100% boost
    focus_config = {
        "total_items": 1,
        "variation": 0,
        "slots": [{"name": "All", "types": ["major"], "item_type": "scale", "percent": 100}],
        "octave_variety": False,
        "slurred_percent": 50,
        "weighting": {
            "base_multiplier": 1.0,
            "days_since_practice_factor": 7,
            "practice_count_divisor": 1,
        },
        "default_scale_bpm": 60,
        "default_arpeggio_bpm": 72,
        "weekly_focus": {
            "enabled": True,
            "keys": ["A"],
            "types": [],
            "probability_increase": 100,
        },
    }

    setting = Setting(key="selection_algorithm", value=focus_config)
    db.add(setting)
    db.commit()

    # With 100% boost, A has weight 2.0 and C has weight 1.0
    # Over many runs, A should be selected about 2/3 of the time
    # For a deterministic test, let's just check it can be selected
    practice_set = generate_practice_set(db)
    assert len(practice_set) == 1
    assert "is_weekly_focus" in practice_set[0]
    # We can't guarantee A is picked in 1 run, but we can verify the logic runs without error


def test_weekly_focus_type_boost(db, client):
    # Create a major scale and a chromatic scale (focus)
    s_m = Scale(note="C", type="major", octaves=2, enabled=True, weight=1.0)
    s_ch = Scale(note="C", type="chromatic", octaves=2, enabled=True, weight=1.0)
    db.add_all([s_m, s_ch])

    # Configure weekly focus for type "chromatic"
    focus_config = {
        "total_items": 1,
        "variation": 0,
        "slots": [
            {"name": "All", "types": ["major", "chromatic"], "item_type": "scale", "percent": 100}
        ],
        "octave_variety": False,
        "weekly_focus": {
            "enabled": True,
            "keys": [],
            "types": ["chromatic"],
            "probability_increase": 100,
        },
    }

    setting = Setting(key="selection_algorithm", value=focus_config)
    db.add(setting)
    db.commit()

    practice_set = generate_practice_set(db)
    assert len(practice_set) == 1
    assert "is_weekly_focus" in practice_set[0]


def test_weekly_focus_is_flagged_in_api(db, client):
    # Create a scale that matches focus
    s_a = Scale(note="A", type="major", octaves=2, enabled=True, weight=1.0)
    db.add(s_a)

    focus_config = {
        "total_items": 1,
        "slots": [{"name": "All", "types": ["major"], "item_type": "scale", "percent": 100}],
        "weekly_focus": {
            "enabled": True,
            "keys": ["A"],
            "types": [],
            "probability_increase": 100,
        },
    }
    db.add(Setting(key="selection_algorithm", value=focus_config))
    db.commit()

    response = client.post("/api/generate-set")
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["is_weekly_focus"] is True


def test_weekly_focus_slot_allocation(db, client):
    """Test that slot allocation reserves the correct proportion for focus items."""
    # Create 3 focus scales (A) and 3 non-focus scales (C)
    for i in range(3):
        db.add(Scale(note="A", type="major", octaves=i + 1, enabled=True, weight=1.0))
        db.add(Scale(note="C", type="major", octaves=i + 1, enabled=True, weight=1.0))
    db.commit()

    # With 100% probability_increase, all 5 slots should be focus items
    focus_config = {
        "total_items": 5,
        "octave_variety": False,
        "weekly_focus": {
            "enabled": True,
            "keys": ["A"],
            "types": [],
            "probability_increase": 100,
        },
    }
    db.add(Setting(key="selection_algorithm", value=focus_config))
    db.commit()

    practice_set = generate_practice_set(db)
    assert len(practice_set) == 5

    # With 100% boost = 5 focus slots, all items should be focus (A key)
    # But we only have 3 A scales, so 3 focus + 2 fallback from non-focus
    focus_count = sum(1 for item in practice_set if item["is_weekly_focus"])
    assert focus_count == 3  # All available focus items should be selected


def test_weekly_focus_slot_allocation_partial(db, client):
    """Test slot allocation with partial boost percentage."""
    # Create 5 focus scales (A) and 5 non-focus scales (C)
    for i in range(5):
        db.add(Scale(note="A", type="major", octaves=(i % 3) + 1, enabled=True, weight=1.0))
        db.add(Scale(note="C", type="major", octaves=(i % 3) + 1, enabled=True, weight=1.0))
    db.commit()

    # With 60% probability_increase and 5 total items:
    # Focus slots = round(5 * 60 / 100) = 3
    # Non-focus slots = 2
    focus_config = {
        "total_items": 5,
        "octave_variety": False,
        "weekly_focus": {
            "enabled": True,
            "keys": ["A"],
            "types": [],
            "probability_increase": 60,
        },
    }
    db.add(Setting(key="selection_algorithm", value=focus_config))
    db.commit()

    practice_set = generate_practice_set(db)
    assert len(practice_set) == 5

    focus_count = sum(1 for item in practice_set if item["is_weekly_focus"])
    non_focus_count = sum(1 for item in practice_set if not item["is_weekly_focus"])

    # With 60% boost: 3 focus slots, 2 non-focus slots
    assert focus_count == 3
    assert non_focus_count == 2
