from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Arpeggio, PracticeEntry, PracticeSession, Scale, SelectionSet, Setting
from services.selector import calculate_all_likelihoods, generate_practice_set

router = APIRouter()


class PracticeItem(BaseModel):
    type: str  # "scale" or "arpeggio"
    id: int
    display_name: str
    octaves: int
    articulation: str  # "slurred" or "separate"
    target_bpm: int  # Target metronome BPM for this item
    is_weekly_focus: bool = False


class GenerateSetResponse(BaseModel):
    items: list[PracticeItem]


class PracticeEntryInput(BaseModel):
    item_type: str
    item_id: int
    articulation: str | None = None  # "slurred" or "separate" (suggested)
    was_practiced: bool = False  # Legacy: true if any practice
    practiced_slurred: bool = False
    practiced_separate: bool = False
    practiced_bpm: int | None = None  # Metronome BPM used during practice
    target_bpm: int | None = None  # Target BPM at time of practice
    matched_target_bpm: bool | None = None  # Whether practiced BPM matched target


class CreateSessionRequest(BaseModel):
    entries: list[PracticeEntryInput]


class SessionResponse(BaseModel):
    id: int
    created_at: datetime
    entries_count: int
    practiced_count: int
    selection_set_id: int | None = None


class PracticeHistoryItem(BaseModel):
    item_type: str
    item_id: int
    display_name: str
    total_sessions: int
    times_practiced: int
    last_practiced: datetime | None
    max_practiced_bpm: int | None
    target_bpm: int | None


class PracticeHistoryDetailedItem(BaseModel):
    item_type: str
    item_id: int
    display_name: str
    subtype: str  # major, minor, chromatic, etc.
    note: str
    accidental: str | None
    octaves: int
    times_practiced: int
    last_practiced: datetime | None
    selection_likelihood: float  # Base probability without weekly focus
    max_practiced_bpm: int | None
    target_bpm: int | None
    is_weekly_focus: bool


@router.post("/generate-set", response_model=GenerateSetResponse)
async def generate_set(db: Session = Depends(get_db)):
    """Generate a randomized practice set based on current configuration."""
    items = generate_practice_set(db)
    return GenerateSetResponse(items=[PracticeItem(**item) for item in items])


@router.post("/practice-session", response_model=SessionResponse)
async def create_practice_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    """Record a practice session with the items that were practiced."""
    # Look up the currently active selection set
    active_set = db.query(SelectionSet).filter(SelectionSet.is_active).first()
    session = PracticeSession(
        selection_set_id=active_set.id if active_set else None,
    )
    db.add(session)
    db.flush()  # Get the session ID

    practiced_count = 0
    for entry_input in request.entries:
        # was_practiced is true if either slurred or separate was practiced
        was_practiced = (
            entry_input.was_practiced
            or entry_input.practiced_slurred
            or entry_input.practiced_separate
        )
        entry = PracticeEntry(
            session_id=session.id,
            item_type=entry_input.item_type,
            item_id=entry_input.item_id,
            articulation=entry_input.articulation,
            was_practiced=was_practiced,
            practiced_slurred=entry_input.practiced_slurred,
            practiced_separate=entry_input.practiced_separate,
            practiced_bpm=entry_input.practiced_bpm,
            target_bpm=entry_input.target_bpm,
            matched_target_bpm=entry_input.matched_target_bpm,
        )
        db.add(entry)
        if was_practiced:
            practiced_count += 1

    db.commit()
    db.refresh(session)

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        entries_count=len(request.entries),
        practiced_count=practiced_count,
        selection_set_id=session.selection_set_id,
    )


@router.get("/practice-history", response_model=list[PracticeHistoryItem])
async def get_practice_history(item_type: str | None = None, db: Session = Depends(get_db)):
    """Get practice statistics for all items."""
    history = []

    # Get stats for scales
    if item_type is None or item_type == "scale":
        scales = db.query(Scale).filter(Scale.enabled).all()
        for scale in scales:
            entries = (
                db.query(PracticeEntry)
                .filter(PracticeEntry.item_type == "scale", PracticeEntry.item_id == scale.id)
                .all()
            )

            total_sessions = len(entries)
            times_practiced = len([e for e in entries if e.was_practiced])
            last_practiced = None
            max_practiced_bpm = None
            if entries:
                practiced_entries = [e for e in entries if e.was_practiced]
                if practiced_entries:
                    last_practiced = max(e.created_at for e in practiced_entries)
                    # Get max practiced BPM from entries with BPM recorded
                    bpm_entries = [
                        e.practiced_bpm for e in practiced_entries if e.practiced_bpm is not None
                    ]
                    if bpm_entries:
                        max_practiced_bpm = max(bpm_entries)

            history.append(
                PracticeHistoryItem(
                    item_type="scale",
                    item_id=scale.id,
                    display_name=scale.display_name(),
                    total_sessions=total_sessions,
                    times_practiced=times_practiced,
                    last_practiced=last_practiced,
                    max_practiced_bpm=max_practiced_bpm,
                    target_bpm=scale.target_bpm,
                )
            )

    # Get stats for arpeggios
    if item_type is None or item_type == "arpeggio":
        arpeggios = db.query(Arpeggio).filter(Arpeggio.enabled).all()
        for arpeggio in arpeggios:
            entries = (
                db.query(PracticeEntry)
                .filter(PracticeEntry.item_type == "arpeggio", PracticeEntry.item_id == arpeggio.id)
                .all()
            )

            total_sessions = len(entries)
            times_practiced = len([e for e in entries if e.was_practiced])
            last_practiced = None
            max_practiced_bpm = None
            if entries:
                practiced_entries = [e for e in entries if e.was_practiced]
                if practiced_entries:
                    last_practiced = max(e.created_at for e in practiced_entries)
                    # Get max practiced BPM from entries with BPM recorded
                    bpm_entries = [
                        e.practiced_bpm for e in practiced_entries if e.practiced_bpm is not None
                    ]
                    if bpm_entries:
                        max_practiced_bpm = max(bpm_entries)

            history.append(
                PracticeHistoryItem(
                    item_type="arpeggio",
                    item_id=arpeggio.id,
                    display_name=arpeggio.display_name(),
                    total_sessions=total_sessions,
                    times_practiced=times_practiced,
                    last_practiced=last_practiced,
                    max_practiced_bpm=max_practiced_bpm,
                    target_bpm=arpeggio.target_bpm,
                )
            )

    # Sort by times practiced (ascending) to show least practiced first
    history.sort(key=lambda x: x.times_practiced)

    return history


@router.get("/practice-history-detailed", response_model=list[PracticeHistoryDetailedItem])
async def get_practice_history_detailed(
    item_type: str | None = Query(None, description="Filter by item type: 'scale' or 'arpeggio'"),
    subtype: str | None = Query(None, description="Filter by subtype (e.g., 'major', 'minor')"),
    note: str | None = Query(None, description="Filter by note (e.g., 'A', 'B', 'C')"),
    accidental: str | None = Query(
        None, description="Filter by accidental: 'flat', 'sharp', or 'natural'"
    ),
    from_date: datetime | None = Query(None, description="Filter entries from this date"),
    to_date: datetime | None = Query(None, description="Filter entries until this date"),
    db: Session = Depends(get_db),
):
    """Get detailed practice statistics with selection likelihood for all items.

    The selection_likelihood reflects the BASE selection probability without any
    weekly focus boost. Weekly focus items receive an additional boost during
    actual practice set generation, which is not reflected in this value.
    """
    history: list[PracticeHistoryDetailedItem] = []

    # Get selection likelihoods for all items (base probability without weekly focus)
    likelihoods = calculate_all_likelihoods(db)

    # Get weekly focus config to determine which items are focus items
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()
    weekly_focus = {}
    if setting and setting.value:
        weekly_focus = setting.value.get("weekly_focus", {})
    wf_enabled = weekly_focus.get("enabled", False)
    wf_keys = weekly_focus.get("keys", [])
    wf_types = weekly_focus.get("types", [])
    wf_categories = weekly_focus.get("categories", [])

    def is_focus_item(item_note: str, item_subtype: str, item_category: str) -> bool:
        """Check if an item matches weekly focus criteria."""
        if not wf_enabled:
            return False
        matches_category = not wf_categories or item_category in wf_categories
        has_key_or_type_criteria = wf_keys or wf_types
        matches_key_or_type = item_note in wf_keys or item_subtype in wf_types
        return matches_category and (not has_key_or_type_criteria or matches_key_or_type)

    def get_filtered_entries(item_type_str: str, item_id: int) -> list[PracticeEntry]:
        """Get practice entries with optional date filtering."""
        query = db.query(PracticeEntry).filter(
            PracticeEntry.item_type == item_type_str,
            PracticeEntry.item_id == item_id,
            PracticeEntry.was_practiced,
        )
        if from_date:
            query = query.filter(PracticeEntry.created_at >= from_date)
        if to_date:
            # Add one day to include the entire end date
            end_of_day = to_date + timedelta(days=1)
            query = query.filter(PracticeEntry.created_at < end_of_day)
        return query.all()

    # Get stats for scales
    if item_type is None or item_type == "scale":
        scales_query = db.query(Scale).filter(Scale.enabled)
        if subtype:
            scales_query = scales_query.filter(Scale.type == subtype)
        if note:
            scales_query = scales_query.filter(Scale.note == note)
        if accidental:
            if accidental == "natural":
                scales_query = scales_query.filter(Scale.accidental.is_(None))
            else:
                scales_query = scales_query.filter(Scale.accidental == accidental)
        scales = scales_query.all()

        for scale in scales:
            entries = get_filtered_entries("scale", scale.id)
            times_practiced = len(entries)
            last_practiced = max((e.created_at for e in entries), default=None)
            likelihood = likelihoods.get(("scale", scale.id), 0.0)

            # Get max practiced BPM
            max_practiced_bpm = None
            bpm_entries = [e.practiced_bpm for e in entries if e.practiced_bpm is not None]
            if bpm_entries:
                max_practiced_bpm = max(bpm_entries)

            history.append(
                PracticeHistoryDetailedItem(
                    item_type="scale",
                    item_id=scale.id,
                    display_name=scale.display_name(),
                    subtype=scale.type,
                    note=scale.note,
                    accidental=scale.accidental,
                    octaves=scale.octaves,
                    times_practiced=times_practiced,
                    last_practiced=last_practiced,
                    selection_likelihood=likelihood,
                    max_practiced_bpm=max_practiced_bpm,
                    target_bpm=scale.target_bpm,
                    is_weekly_focus=is_focus_item(scale.note, scale.type, "scale"),
                )
            )

    # Get stats for arpeggios
    if item_type is None or item_type == "arpeggio":
        arpeggios_query = db.query(Arpeggio).filter(Arpeggio.enabled)
        if subtype:
            arpeggios_query = arpeggios_query.filter(Arpeggio.type == subtype)
        if note:
            arpeggios_query = arpeggios_query.filter(Arpeggio.note == note)
        if accidental:
            if accidental == "natural":
                arpeggios_query = arpeggios_query.filter(Arpeggio.accidental.is_(None))
            else:
                arpeggios_query = arpeggios_query.filter(Arpeggio.accidental == accidental)
        arpeggios = arpeggios_query.all()

        for arpeggio in arpeggios:
            entries = get_filtered_entries("arpeggio", arpeggio.id)
            times_practiced = len(entries)
            last_practiced = max((e.created_at for e in entries), default=None)
            likelihood = likelihoods.get(("arpeggio", arpeggio.id), 0.0)

            # Get max practiced BPM
            max_practiced_bpm = None
            bpm_entries = [e.practiced_bpm for e in entries if e.practiced_bpm is not None]
            if bpm_entries:
                max_practiced_bpm = max(bpm_entries)

            history.append(
                PracticeHistoryDetailedItem(
                    item_type="arpeggio",
                    item_id=arpeggio.id,
                    display_name=arpeggio.display_name(),
                    subtype=arpeggio.type,
                    note=arpeggio.note,
                    accidental=arpeggio.accidental,
                    octaves=arpeggio.octaves,
                    times_practiced=times_practiced,
                    last_practiced=last_practiced,
                    selection_likelihood=likelihood,
                    max_practiced_bpm=max_practiced_bpm,
                    target_bpm=arpeggio.target_bpm,
                    is_weekly_focus=is_focus_item(arpeggio.note, arpeggio.type, "arpeggio"),
                )
            )

    return history
