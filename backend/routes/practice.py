from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Arpeggio, PracticeEntry, PracticeSession, Scale
from services.selector import generate_practice_set

router = APIRouter()


class PracticeItem(BaseModel):
    type: str  # "scale" or "arpeggio"
    id: int
    display_name: str
    octaves: int
    articulation: str  # "slurred" or "separate"
    target_bpm: int  # Target metronome BPM for this item


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


class PracticeHistoryItem(BaseModel):
    item_type: str
    item_id: int
    display_name: str
    total_sessions: int
    times_practiced: int
    last_practiced: datetime | None
    max_practiced_bpm: int | None
    target_bpm: int | None


@router.post("/generate-set", response_model=GenerateSetResponse)
async def generate_set(db: Session = Depends(get_db)):
    """Generate a randomized practice set based on current configuration."""
    items = generate_practice_set(db)
    return GenerateSetResponse(items=[PracticeItem(**item) for item in items])


@router.post("/practice-session", response_model=SessionResponse)
async def create_practice_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    """Record a practice session with the items that were practiced."""
    session = PracticeSession()
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
