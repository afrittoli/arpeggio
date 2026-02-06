from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import Scale
from services.initializer import init_scales_and_arpeggios

router = APIRouter()


class ScaleResponse(BaseModel):
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


class ScaleUpdate(BaseModel):
    enabled: bool | None = None
    weight: float | None = None
    target_bpm: int | None = None
    articulation_mode: str | None = None


class BulkEnableRequest(BaseModel):
    ids: list[int]
    enabled: bool


class BulkArticulationRequest(BaseModel):
    ids: list[int]
    articulation_mode: str


@router.get("/scales", response_model=list[ScaleResponse])
async def get_scales(
    note: str | None = None,
    type: str | None = None,
    octaves: int | None = None,
    enabled: bool | None = None,
    db: Session = Depends(get_db),
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
            target_bpm=s.target_bpm,
            articulation_mode=s.articulation_mode,
            display_name=s.display_name(),
        )
        for s in scales
    ]


@router.put("/scales/{scale_id}", response_model=ScaleResponse)
async def update_scale(
    scale_id: int,
    update: ScaleUpdate,
    db: Session = Depends(get_db),
):
    """Update a scale's enabled status, weight, or articulation mode."""
    scale = db.query(Scale).filter(Scale.id == scale_id).first()
    if not scale:
        raise HTTPException(status_code=404, detail="Scale not found")

    if update.enabled is not None:
        scale.enabled = update.enabled
    if update.weight is not None:
        scale.weight = update.weight
    if update.target_bpm is not None:
        # Allow clearing by setting to 0
        scale.target_bpm = update.target_bpm if update.target_bpm > 0 else None
    if update.articulation_mode is not None:
        valid_modes = ("both", "slurred_only", "separate_only")
        if update.articulation_mode in valid_modes:
            scale.articulation_mode = update.articulation_mode

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
        target_bpm=scale.target_bpm,
        articulation_mode=scale.articulation_mode,
        display_name=scale.display_name(),
    )


@router.post("/scales/bulk-enable")
async def bulk_enable_scales(
    request: BulkEnableRequest,
    db: Session = Depends(get_db),
):
    """Enable or disable multiple scales at once."""
    updated = (
        db.query(Scale)
        .filter(Scale.id.in_(request.ids))
        .update({"enabled": request.enabled}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


@router.post("/scales/bulk-articulation")
async def bulk_articulation_scales(
    request: BulkArticulationRequest,
    db: Session = Depends(get_db),
):
    """Update articulation mode for multiple scales at once."""
    valid_modes = ("both", "slurred_only", "separate_only")
    if request.articulation_mode not in valid_modes:
        raise HTTPException(status_code=400, detail="Invalid articulation mode")

    updated = (
        db.query(Scale)
        .filter(Scale.id.in_(request.ids))
        .update(
            {"articulation_mode": request.articulation_mode},
            synchronize_session=False,
        )
    )
    db.commit()
    return {"updated": updated}


@router.post("/init-database")
async def initialize_database(db: Session = Depends(get_db)):
    """Initialize the database with all scale and arpeggio combinations."""
    result = init_scales_and_arpeggios(db)
    return result
