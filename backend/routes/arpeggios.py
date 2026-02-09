from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import Arpeggio

router = APIRouter()


class ArpeggioResponse(BaseModel):
    id: int
    note: str
    accidental: str | None
    type: str
    octaves: int
    enabled: bool
    weight: float
    target_bpm: int | None
    articulation_mode: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class ArpeggioUpdate(BaseModel):
    enabled: bool | None = None
    weight: float | None = None
    target_bpm: int | None = None
    articulation_mode: Literal["both", "separate_only", "slurred_only"] | None = None


class BulkEnableRequest(BaseModel):
    ids: list[int]
    enabled: bool


@router.get("/arpeggios", response_model=list[ArpeggioResponse])
async def get_arpeggios(
    note: str | None = None,
    type: str | None = None,
    octaves: int | None = None,
    enabled: bool | None = None,
    db: Session = Depends(get_db),
):
    """Get all arpeggios with optional filtering."""
    query = db.query(Arpeggio)

    if note:
        query = query.filter(Arpeggio.note == note)
    if type:
        query = query.filter(Arpeggio.type == type)
    if octaves:
        query = query.filter(Arpeggio.octaves == octaves)
    if enabled is not None:
        query = query.filter(Arpeggio.enabled == enabled)

    arpeggios = query.order_by(
        Arpeggio.note, Arpeggio.accidental, Arpeggio.type, Arpeggio.octaves
    ).all()

    return [
        ArpeggioResponse(
            id=a.id,
            note=a.note,
            accidental=a.accidental,
            type=a.type,
            octaves=a.octaves,
            enabled=a.enabled,
            weight=a.weight,
            target_bpm=a.target_bpm,
            articulation_mode=a.articulation_mode,
            display_name=a.display_name(),
        )
        for a in arpeggios
    ]


@router.put("/arpeggios/{arpeggio_id}", response_model=ArpeggioResponse)
async def update_arpeggio(arpeggio_id: int, update: ArpeggioUpdate, db: Session = Depends(get_db)):
    """Update an arpeggio's enabled status or weight."""
    arpeggio = db.query(Arpeggio).filter(Arpeggio.id == arpeggio_id).first()
    if not arpeggio:
        raise HTTPException(status_code=404, detail="Arpeggio not found")

    if update.enabled is not None:
        arpeggio.enabled = update.enabled
    if update.weight is not None:
        arpeggio.weight = update.weight
    if update.target_bpm is not None:
        # Allow clearing by setting to 0
        arpeggio.target_bpm = update.target_bpm if update.target_bpm > 0 else None
    if update.articulation_mode is not None:
        arpeggio.articulation_mode = update.articulation_mode

    db.commit()
    db.refresh(arpeggio)

    return ArpeggioResponse(
        id=arpeggio.id,
        note=arpeggio.note,
        accidental=arpeggio.accidental,
        type=arpeggio.type,
        octaves=arpeggio.octaves,
        enabled=arpeggio.enabled,
        weight=arpeggio.weight,
        target_bpm=arpeggio.target_bpm,
        articulation_mode=arpeggio.articulation_mode,
        display_name=arpeggio.display_name(),
    )


@router.post("/arpeggios/bulk-enable")
async def bulk_enable_arpeggios(request: BulkEnableRequest, db: Session = Depends(get_db)):
    """Enable or disable multiple arpeggios at once."""
    updated = (
        db.query(Arpeggio)
        .filter(Arpeggio.id.in_(request.ids))
        .update({"enabled": request.enabled}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}
