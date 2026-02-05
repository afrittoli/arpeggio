import random
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from models import DEFAULT_ALGORITHM_CONFIG, Arpeggio, PracticeEntry, Scale, Setting


def get_algorithm_config(db: Session) -> dict[str, Any]:
    """Get the current algorithm configuration from the database."""
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()
    if setting:
        return dict(setting.value)
    return DEFAULT_ALGORITHM_CONFIG


def calculate_item_weight(
    base_weight: float,
    practice_count: int,
    days_since_practice: int | None,
    weighting_config: dict[str, Any],
) -> float:
    """Calculate the final weight for an item based on config."""
    base_mult = float(weighting_config.get("base_multiplier", 1.0))
    days_factor = float(weighting_config.get("days_since_practice_factor", 7))
    count_divisor = float(weighting_config.get("practice_count_divisor", 1))

    # If never practiced, treat as very old (30 days)
    if days_since_practice is None:
        days_since_practice = 30

    # Formula: base_weight * base_multiplier * (1 + days_since/days_factor) / (practice_count + divisor)
    return (
        base_weight
        * base_mult
        * (1 + days_since_practice / days_factor)
        / (practice_count + count_divisor)
    )


def get_practice_stats(db: Session, item_type: str, item_id: int) -> tuple[int, int | None]:
    """Get practice count and days since last practice for an item."""
    entries = (
        db.query(PracticeEntry)
        .filter(
            PracticeEntry.item_type == item_type,
            PracticeEntry.item_id == item_id,
            PracticeEntry.was_practiced,
        )
        .all()
    )

    practice_count = len(entries)

    if entries:
        last_practice = max(e.created_at for e in entries)
        days_since = (datetime.utcnow() - last_practice).days
    else:
        days_since = None

    return practice_count, days_since


def weighted_random_choice(
    items: list[tuple[dict[str, Any], float]], count: int
) -> list[dict[str, Any]]:
    """Select items using weighted random selection without replacement."""
    if not items or count <= 0:
        return []

    selected: list[dict[str, Any]] = []
    remaining = list(items)

    for _ in range(min(count, len(remaining))):
        if not remaining:
            break

        total_weight = sum(w for _, w in remaining)
        if total_weight <= 0:
            # Fall back to uniform random if all weights are 0
            idx = random.randint(0, len(remaining) - 1)
        else:
            r = random.uniform(0, total_weight)
            cumulative: float = 0.0
            idx = 0
            for i, (_, w) in enumerate(remaining):
                cumulative += w
                if cumulative >= r:
                    idx = i
                    break

        selected.append(remaining[idx][0])
        remaining.pop(idx)

    return selected


def _build_item_data(
    item: Scale | Arpeggio,
    item_type: str,
    default_bpm: int,
    is_focus: bool,
) -> dict[str, Any]:
    """Build the item data dictionary."""
    return {
        "type": item_type,
        "id": item.id,
        "display_name": item.display_name(),
        "octaves": item.octaves,
        "target_bpm": item.target_bpm or default_bpm,
        "is_weekly_focus": is_focus,
    }


def _get_all_weighted_items(
    db: Session,
    weighting_config: dict[str, Any],
    octave_variety: bool,
    used_octaves: list[int],
    default_scale_bpm: int,
    default_arpeggio_bpm: int,
    wf_enabled: bool,
    wf_keys: list[str],
    wf_types: list[str],
    excluded_ids: set[tuple[str, int]] | None = None,
) -> tuple[list[tuple[dict[str, Any], float]], list[tuple[dict[str, Any], float]]]:
    """
    Get all enabled items with weights, split into focus and non-focus pools.
    Returns (focus_items, non_focus_items) where each is list of (item_data, weight).
    """
    excluded = excluded_ids or set()
    focus_items: list[tuple[dict[str, Any], float]] = []
    non_focus_items: list[tuple[dict[str, Any], float]] = []

    # Process scales
    scales = db.query(Scale).filter(Scale.enabled).all()
    for s in scales:
        if ("scale", s.id) in excluded:
            continue
        practice_count, days_since = get_practice_stats(db, "scale", s.id)
        weight = calculate_item_weight(s.weight, practice_count, days_since, weighting_config)
        if octave_variety and s.octaves in used_octaves:
            weight *= 0.5

        is_focus = wf_enabled and (s.note in wf_keys or s.type in wf_types)
        item_data = _build_item_data(s, "scale", default_scale_bpm, is_focus)

        if is_focus:
            focus_items.append((item_data, weight))
        else:
            non_focus_items.append((item_data, weight))

    # Process arpeggios
    arps = db.query(Arpeggio).filter(Arpeggio.enabled).all()
    for a in arps:
        if ("arpeggio", a.id) in excluded:
            continue
        practice_count, days_since = get_practice_stats(db, "arpeggio", a.id)
        weight = calculate_item_weight(a.weight, practice_count, days_since, weighting_config)
        if octave_variety and a.octaves in used_octaves:
            weight *= 0.5

        is_focus = wf_enabled and (a.note in wf_keys or a.type in wf_types)
        item_data = _build_item_data(a, "arpeggio", default_arpeggio_bpm, is_focus)

        if is_focus:
            focus_items.append((item_data, weight))
        else:
            non_focus_items.append((item_data, weight))

    return focus_items, non_focus_items


def generate_practice_set(db: Session) -> list[dict[str, Any]]:
    """
    Generate a practice set based on the current algorithm configuration.

    When Weekly Focus is enabled, the set is built using slot allocation:
    - A percentage of slots (based on probability_increase) are reserved for focus items
    - Focus slots are filled first from items matching the focus criteria
    - Remaining slots are filled from non-focus items
    - If either pool can't fill its allocated slots, the other pool is used as fallback
    """
    config = get_algorithm_config(db)

    total_items = int(config.get("total_items", 5))
    if total_items <= 0:
        total_items = 5
    octave_variety = bool(config.get("octave_variety", True))
    weighting_config: dict[str, Any] = config.get("weighting", {})
    default_scale_bpm = int(config.get("default_scale_bpm", 60))
    default_arpeggio_bpm = int(config.get("default_arpeggio_bpm", 72))
    weekly_focus = config.get("weekly_focus", {})
    wf_enabled = weekly_focus.get("enabled", False)
    wf_keys = weekly_focus.get("keys", [])
    wf_types = weekly_focus.get("types", [])
    wf_probability = float(weekly_focus.get("probability_increase", 80))

    slurred_percent = float(config.get("slurred_percent", 50))

    selected_items: list[dict[str, Any]] = []
    used_octaves: list[int] = []

    # Get all items split by focus status
    focus_pool, non_focus_pool = _get_all_weighted_items(
        db,
        weighting_config,
        octave_variety,
        used_octaves,
        default_scale_bpm,
        default_arpeggio_bpm,
        wf_enabled,
        wf_keys,
        wf_types,
    )

    if wf_enabled and (wf_keys or wf_types):
        # Slot allocation mode: reserve slots for focus items
        focus_slots = round(total_items * wf_probability / 100)
        non_focus_slots = total_items - focus_slots

        # Phase 1: Fill focus slots from focus pool
        focus_selections = weighted_random_choice(focus_pool, focus_slots)
        for sel in focus_selections:
            selected_items.append(sel)
            used_octaves.append(int(sel["octaves"]))

        # Track selected IDs to avoid duplicates
        selected_ids = {(i["type"], i["id"]) for i in selected_items}

        # Phase 2: Fill non-focus slots from non-focus pool
        available_non_focus = [
            (d, w) for d, w in non_focus_pool if (d["type"], d["id"]) not in selected_ids
        ]
        non_focus_selections = weighted_random_choice(available_non_focus, non_focus_slots)
        for sel in non_focus_selections:
            selected_items.append(sel)
            used_octaves.append(int(sel["octaves"]))
            selected_ids.add((sel["type"], sel["id"]))

        # Phase 3: Fallback if we couldn't fill all slots
        if len(selected_items) < total_items:
            needed = total_items - len(selected_items)
            # Try remaining focus items first, then non-focus
            all_remaining = [
                (d, w)
                for d, w in focus_pool + non_focus_pool
                if (d["type"], d["id"]) not in selected_ids
            ]
            fallback_selections = weighted_random_choice(all_remaining, needed)
            for sel in fallback_selections:
                selected_items.append(sel)
                used_octaves.append(int(sel["octaves"]))
    else:
        # Standard mode: no weekly focus, select from all items
        all_items = focus_pool + non_focus_pool
        selections = weighted_random_choice(all_items, total_items)
        for sel in selections:
            selected_items.append(sel)
            used_octaves.append(int(sel["octaves"]))

    random.shuffle(selected_items)
    for selected in selected_items:
        selected["articulation"] = (
            "slurred" if random.random() * 100 < slurred_percent else "separate"
        )

    return selected_items
