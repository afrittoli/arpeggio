from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Arpeggio

router = APIRouter()


class ArpeggioResponse(BaseModel):
    id: int
    note: str
    accidental: Optional[str]
    type: str
    octaves: int
    enabled: bool
    weight: float
    display_name: str

    class Config:
        from_attributes = True


class ArpeggioUpdate(BaseModel):
    enabled: Optional[bool] = None
    weight: Optional[float] = None


class BulkEnableRequest(BaseModel):
    ids: list[int]
    enabled: bool


@router.get("/arpeggios", response_model=list[ArpeggioResponse])
async def get_arpeggios(
    note: Optional[str] = None,
    type: Optional[str] = None,
    octaves: Optional[int] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db)
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

    arpeggios = query.order_by(Arpeggio.note, Arpeggio.accidental, Arpeggio.type, Arpeggio.octaves).all()

    return [
        ArpeggioResponse(
            id=a.id,
            note=a.note,
            accidental=a.accidental,
            type=a.type,
            octaves=a.octaves,
            enabled=a.enabled,
            weight=a.weight,
            display_name=a.display_name()
        )
        for a in arpeggios
    ]


@router.put("/arpeggios/{arpeggio_id}", response_model=ArpeggioResponse)
async def update_arpeggio(
    arpeggio_id: int,
    update: ArpeggioUpdate,
    db: Session = Depends(get_db)
):
    """Update an arpeggio's enabled status or weight."""
    arpeggio = db.query(Arpeggio).filter(Arpeggio.id == arpeggio_id).first()
    if not arpeggio:
        raise HTTPException(status_code=404, detail="Arpeggio not found")

    if update.enabled is not None:
        arpeggio.enabled = update.enabled
    if update.weight is not None:
        arpeggio.weight = update.weight

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
        display_name=arpeggio.display_name()
    )


@router.post("/arpeggios/bulk-enable")
async def bulk_enable_arpeggios(
    request: BulkEnableRequest,
    db: Session = Depends(get_db)
):
    """Enable or disable multiple arpeggios at once."""
    updated = db.query(Arpeggio).filter(Arpeggio.id.in_(request.ids)).update(
        {"enabled": request.enabled},
        synchronize_session=False
    )
    db.commit()
    return {"updated": updated}
