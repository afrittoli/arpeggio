from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Scale
from services.initializer import init_scales_and_arpeggios

router = APIRouter()


class ScaleResponse(BaseModel):
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


class ScaleUpdate(BaseModel):
    enabled: Optional[bool] = None
    weight: Optional[float] = None


class BulkEnableRequest(BaseModel):
    ids: list[int]
    enabled: bool


@router.get("/scales", response_model=list[ScaleResponse])
async def get_scales(
    note: Optional[str] = None,
    type: Optional[str] = None,
    octaves: Optional[int] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get all scales with optional filtering."""
    query = db.query(Scale)

    if note:
        query = query.filter(Scale.note == note)
    if type:
        query = query.filter(Scale.type == type)
    if octaves:
        query = query.filter(Scale.octaves == octaves)
    if enabled is not None:
        query = query.filter(Scale.enabled == enabled)

    scales = query.order_by(Scale.note, Scale.accidental, Scale.type, Scale.octaves).all()

    return [
        ScaleResponse(
            id=s.id,
            note=s.note,
            accidental=s.accidental,
            type=s.type,
            octaves=s.octaves,
            enabled=s.enabled,
            weight=s.weight,
            display_name=s.display_name()
        )
        for s in scales
    ]


@router.put("/scales/{scale_id}", response_model=ScaleResponse)
async def update_scale(
    scale_id: int,
    update: ScaleUpdate,
    db: Session = Depends(get_db)
):
    """Update a scale's enabled status or weight."""
    scale = db.query(Scale).filter(Scale.id == scale_id).first()
    if not scale:
        raise HTTPException(status_code=404, detail="Scale not found")

    if update.enabled is not None:
        scale.enabled = update.enabled
    if update.weight is not None:
        scale.weight = update.weight

    db.commit()
    db.refresh(scale)

    return ScaleResponse(
        id=scale.id,
        note=scale.note,
        accidental=scale.accidental,
        type=scale.type,
        octaves=scale.octaves,
        enabled=scale.enabled,
        weight=scale.weight,
        display_name=scale.display_name()
    )


@router.post("/scales/bulk-enable")
async def bulk_enable_scales(
    request: BulkEnableRequest,
    db: Session = Depends(get_db)
):
    """Enable or disable multiple scales at once."""
    updated = db.query(Scale).filter(Scale.id.in_(request.ids)).update(
        {"enabled": request.enabled},
        synchronize_session=False
    )
    db.commit()
    return {"updated": updated}


@router.post("/init-database")
async def initialize_database(db: Session = Depends(get_db)):
    """Initialize the database with all scale and arpeggio combinations."""
    result = init_scales_and_arpeggios(db)
    return result
