import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Scale, Arpeggio, PracticeEntry, Setting, DEFAULT_ALGORITHM_CONFIG
from typing import Any


def get_algorithm_config(db: Session) -> dict[str, Any]:
    """Get the current algorithm configuration from the database."""
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()
    if setting:
        return setting.value
    return DEFAULT_ALGORITHM_CONFIG


def calculate_item_weight(
    base_weight: float,
    practice_count: int,
    days_since_practice: int | None,
    weighting_config: dict
) -> float:
    """Calculate the final weight for an item based on config."""
    base_mult = weighting_config.get("base_multiplier", 1.0)
    days_factor = weighting_config.get("days_since_practice_factor", 7)
    count_divisor = weighting_config.get("practice_count_divisor", 1)

    # If never practiced, treat as very old (30 days)
    if days_since_practice is None:
        days_since_practice = 30

    # Formula: base_weight * base_multiplier * (1 + days_since/days_factor) / (practice_count + divisor)
    return base_weight * base_mult * (1 + days_since_practice / days_factor) / (practice_count + count_divisor)


def get_practice_stats(db: Session, item_type: str, item_id: int) -> tuple[int, int | None]:
    """Get practice count and days since last practice for an item."""
    entries = db.query(PracticeEntry).filter(
        PracticeEntry.item_type == item_type,
        PracticeEntry.item_id == item_id,
        PracticeEntry.was_practiced == True
    ).all()

    practice_count = len(entries)

    if entries:
        last_practice = max(e.created_at for e in entries)
        days_since = (datetime.utcnow() - last_practice).days
    else:
        days_since = None

    return practice_count, days_since


def weighted_random_choice(items: list[tuple[Any, float]], count: int) -> list[Any]:
    """Select items using weighted random selection without replacement."""
    if not items or count <= 0:
        return []

    selected = []
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
            cumulative = 0
            idx = 0
            for i, (_, w) in enumerate(remaining):
                cumulative += w
                if cumulative >= r:
                    idx = i
                    break

        selected.append(remaining[idx][0])
        remaining.pop(idx)

    return selected


def generate_practice_set(db: Session) -> list[dict]:
    """Generate a practice set based on the current algorithm configuration."""
    config = get_algorithm_config(db)

    total_items = config.get("total_items", 5)
    slots = config.get("slots", [])
    octave_variety = config.get("octave_variety", True)
    max_arpeggio_percent = config.get("max_arpeggio_percent")
    weighting_config = config.get("weighting", {})

    # Calculate max arpeggios from percentage (None means no limit)
    max_arpeggios = None
    if max_arpeggio_percent is not None:
        max_arpeggios = max(1, int(total_items * max_arpeggio_percent / 100))

    selected_items = []
    used_octaves = []
    arpeggio_count = 0

    # Process each slot
    for slot in slots:
        if len(selected_items) >= total_items:
            break

        slot_types = slot.get("types", [])
        item_type = slot.get("item_type", "scale")
        min_count = slot.get("min_count", 0)
        max_count = slot.get("max_count", 1)

        # Determine how many items to pick from this slot
        remaining_space = total_items - len(selected_items)

        # Apply arpeggio limit if this is an arpeggio slot
        if item_type == "arpeggio" and max_arpeggios is not None:
            remaining_arpeggio_space = max_arpeggios - arpeggio_count
            if remaining_arpeggio_space <= 0:
                continue
            max_count = min(max_count, remaining_arpeggio_space)

        count = random.randint(min_count, min(max_count, remaining_space))

        if count <= 0:
            continue

        # Get enabled items of the specified types
        if item_type == "scale":
            query = db.query(Scale).filter(
                Scale.enabled == True,
                Scale.type.in_(slot_types)
            )
            items = query.all()
            items_with_weights = []
            for item in items:
                practice_count, days_since = get_practice_stats(db, "scale", item.id)
                weight = calculate_item_weight(item.weight, practice_count, days_since, weighting_config)

                # Apply octave variety penalty
                if octave_variety and item.octaves in used_octaves:
                    weight *= 0.5

                items_with_weights.append((
                    {"type": "scale", "id": item.id, "display_name": item.display_name(), "octaves": item.octaves},
                    weight
                ))
        else:  # arpeggio
            query = db.query(Arpeggio).filter(
                Arpeggio.enabled == True,
                Arpeggio.type.in_(slot_types)
            )
            items = query.all()
            items_with_weights = []
            for item in items:
                practice_count, days_since = get_practice_stats(db, "arpeggio", item.id)
                weight = calculate_item_weight(item.weight, practice_count, days_since, weighting_config)

                # Apply octave variety penalty
                if octave_variety and item.octaves in used_octaves:
                    weight *= 0.5

                items_with_weights.append((
                    {"type": "arpeggio", "id": item.id, "display_name": item.display_name(), "octaves": item.octaves},
                    weight
                ))

        # Select items from this slot
        slot_selections = weighted_random_choice(items_with_weights, count)
        for item in slot_selections:
            selected_items.append(item)
            used_octaves.append(item["octaves"])
            if item["type"] == "arpeggio":
                arpeggio_count += 1

    # If we haven't reached total_items, fill from any remaining enabled items
    if len(selected_items) < total_items:
        selected_ids = {(item["type"], item["id"]) for item in selected_items}
        remaining_needed = total_items - len(selected_items)

        # Gather all enabled items not yet selected
        all_remaining = []

        # Add remaining scales
        all_scales = db.query(Scale).filter(Scale.enabled == True).all()
        for item in all_scales:
            if ("scale", item.id) not in selected_ids:
                practice_count, days_since = get_practice_stats(db, "scale", item.id)
                weight = calculate_item_weight(item.weight, practice_count, days_since, weighting_config)
                if octave_variety and item.octaves in used_octaves:
                    weight *= 0.5
                all_remaining.append((
                    {"type": "scale", "id": item.id, "display_name": item.display_name(), "octaves": item.octaves},
                    weight
                ))

        # Add remaining arpeggios (only if we haven't hit the arpeggio limit)
        if max_arpeggios is None or arpeggio_count < max_arpeggios:
            all_arpeggios = db.query(Arpeggio).filter(Arpeggio.enabled == True).all()
            for item in all_arpeggios:
                if ("arpeggio", item.id) not in selected_ids:
                    practice_count, days_since = get_practice_stats(db, "arpeggio", item.id)
                    weight = calculate_item_weight(item.weight, practice_count, days_since, weighting_config)
                    if octave_variety and item.octaves in used_octaves:
                        weight *= 0.5
                    all_remaining.append((
                        {"type": "arpeggio", "id": item.id, "display_name": item.display_name(), "octaves": item.octaves},
                        weight
                    ))

        # Fill remaining slots (respecting arpeggio limit)
        extra_selections = weighted_random_choice(all_remaining, remaining_needed)
        for item in extra_selections:
            # Skip arpeggios if we've hit the limit
            if item["type"] == "arpeggio" and max_arpeggios is not None and arpeggio_count >= max_arpeggios:
                continue
            selected_items.append(item)
            used_octaves.append(item["octaves"])
            if item["type"] == "arpeggio":
                arpeggio_count += 1

    # Shuffle the final list so it's not always in slot order
    random.shuffle(selected_items)

    return selected_items
