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


def generate_practice_set(db: Session) -> list[dict[str, Any]]:
    """Generate a practice set based on the current algorithm configuration."""
    config = get_algorithm_config(db)

    total_items = int(config.get("total_items", 5))
    if total_items <= 0:
        total_items = 5
    slots = config.get("slots", [])
    variation = float(config.get("variation", 20))
    octave_variety = bool(config.get("octave_variety", True))
    weighting_config: dict[str, Any] = config.get("weighting", {})
    default_scale_bpm = int(config.get("default_scale_bpm", 60))
    default_arpeggio_bpm = int(config.get("default_arpeggio_bpm", 72))
    weekly_focus = config.get("weekly_focus", {})
    wf_enabled = weekly_focus.get("enabled", False)
    wf_keys = weekly_focus.get("keys", [])
    wf_types = weekly_focus.get("types", [])
    wf_boost = 1.0 + (float(weekly_focus.get("probability_increase", 80)) / 100.0)

    slurred_percent = float(config.get("slurred_percent", 50))

    selected_items: list[dict[str, Any]] = []
    used_octaves: list[int] = []

    # Process each slot
    for slot in slots:
        if len(selected_items) >= total_items:
            break

        slot_types = slot.get("types", [])
        item_type = slot.get("item_type", "scale")

        # Calculate target count from percentage, with variation
        target_percent = float(slot.get("percent", 25))
        half_variation = variation / 2
        min_percent = max(0.0, target_percent - half_variation)
        max_percent = min(100.0, target_percent + half_variation)

        # Convert percentages to counts
        min_count = max(0, int(total_items * min_percent / 100))
        max_count = max(min_count, int(total_items * max_percent / 100))

        # Determine how many items to pick from this slot
        remaining_space = total_items - len(selected_items)
        upper_bound = min(max_count, remaining_space)
        lower_bound = min(min_count, upper_bound)

        if upper_bound <= 0:
            continue

        count = random.randint(lower_bound, upper_bound)
        if count <= 0:
            continue

        items_with_weights: list[tuple[dict[str, Any], float]] = []

        if item_type == "scale":
            items = db.query(Scale).filter(Scale.enabled, Scale.type.in_(slot_types)).all()
            for item in items:
                practice_count, days_since = get_practice_stats(db, "scale", item.id)
                weight = calculate_item_weight(
                    item.weight, practice_count, days_since, weighting_config
                )

                is_wf = False
                if wf_enabled and (item.note in wf_keys or item.type in wf_types):
                    weight *= wf_boost
                    is_wf = True

                if octave_variety and item.octaves in used_octaves:
                    weight *= 0.5

                items_with_weights.append(
                    (
                        {
                            "type": "scale",
                            "id": item.id,
                            "display_name": item.display_name(),
                            "octaves": item.octaves,
                            "target_bpm": item.target_bpm or default_scale_bpm,
                            "is_weekly_focus": is_wf,
                        },
                        weight,
                    )
                )
        else:
            arp_items = (
                db.query(Arpeggio).filter(Arpeggio.enabled, Arpeggio.type.in_(slot_types)).all()
            )
            for arp in arp_items:
                practice_count, days_since = get_practice_stats(db, "arpeggio", arp.id)
                weight = calculate_item_weight(
                    arp.weight, practice_count, days_since, weighting_config
                )

                is_wf = False
                if wf_enabled and (arp.note in wf_keys or arp.type in wf_types):
                    weight *= wf_boost
                    is_wf = True

                if octave_variety and arp.octaves in used_octaves:
                    weight *= 0.5

                items_with_weights.append(
                    (
                        {
                            "type": "arpeggio",
                            "id": arp.id,
                            "display_name": arp.display_name(),
                            "octaves": arp.octaves,
                            "target_bpm": arp.target_bpm or default_arpeggio_bpm,
                            "is_weekly_focus": is_wf,
                        },
                        weight,
                    )
                )

        selections = weighted_random_choice(items_with_weights, count)
        for sel in selections:
            selected_items.append(sel)
            used_octaves.append(int(sel["octaves"]))

    # Fallback to fill remaining items
    if len(selected_items) < total_items:
        needed = total_items - len(selected_items)
        selected_ids = {(i["type"], i["id"]) for i in selected_items}

        all_remaining: list[tuple[dict[str, Any], float]] = []

        # Add scales
        scales = db.query(Scale).filter(Scale.enabled).all()
        for s in scales:
            if ("scale", s.id) not in selected_ids:
                practice_count, days_since = get_practice_stats(db, "scale", s.id)
                weight = calculate_item_weight(
                    s.weight, practice_count, days_since, weighting_config
                )
                is_wf = False
                if wf_enabled and (s.note in wf_keys or s.type in wf_types):
                    weight *= wf_boost
                    is_wf = True
                if octave_variety and s.octaves in used_octaves:
                    weight *= 0.5
                all_remaining.append(
                    (
                        {
                            "type": "scale",
                            "id": s.id,
                            "display_name": s.display_name(),
                            "octaves": s.octaves,
                            "target_bpm": s.target_bpm or default_scale_bpm,
                            "is_weekly_focus": is_wf,
                        },
                        weight,
                    )
                )

        # Add arpeggios
        arps = db.query(Arpeggio).filter(Arpeggio.enabled).all()
        for a in arps:
            if ("arpeggio", a.id) not in selected_ids:
                practice_count, days_since = get_practice_stats(db, "arpeggio", a.id)
                weight = calculate_item_weight(
                    a.weight, practice_count, days_since, weighting_config
                )
                is_wf = False
                if wf_enabled and (a.note in wf_keys or a.type in wf_types):
                    weight *= wf_boost
                    is_wf = True
                if octave_variety and a.octaves in used_octaves:
                    weight *= 0.5
                all_remaining.append(
                    (
                        {
                            "type": "arpeggio",
                            "id": a.id,
                            "display_name": a.display_name(),
                            "octaves": a.octaves,
                            "target_bpm": a.target_bpm or default_arpeggio_bpm,
                            "is_weekly_focus": is_wf,
                        },
                        weight,
                    )
                )

        selections = weighted_random_choice(all_remaining, needed)
        for sel in selections:
            selected_items.append(sel)
            used_octaves.append(int(sel["octaves"]))

    random.shuffle(selected_items)
    for selected in selected_items:
        selected["articulation"] = (
            "slurred" if random.random() * 100 < slurred_percent else "separate"
        )

    return selected_items
