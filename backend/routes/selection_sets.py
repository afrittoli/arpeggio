"""Routes for managing named selection sets (presets)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models import Arpeggio, Scale, SelectionSet

router = APIRouter()


class SelectionSetCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be empty")
        return v.strip()


class SelectionSetUpdate(BaseModel):
    name: str | None = None
    scale_ids: list[int] | None = None
    arpeggio_ids: list[int] | None = None
    update_from_current: bool = False

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name must not be empty")
        return v.strip() if v else v


class SelectionSetResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    scale_ids: list[int]
    arpeggio_ids: list[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/selection-sets", response_model=list[SelectionSetResponse])
async def list_selection_sets(db: Session = Depends(get_db)):
    """List all saved selection sets."""
    sets = db.query(SelectionSet).order_by(SelectionSet.name).all()
    return sets


@router.post("/selection-sets", response_model=SelectionSetResponse)
async def create_selection_set(request: SelectionSetCreate, db: Session = Depends(get_db)):
    """Save the current selection (enabled scales/arpeggios) as a new named set."""
    # Check for duplicate name
    existing = db.query(SelectionSet).filter(SelectionSet.name == request.name).first()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Selection set '{request.name}' already exists"
        )

    # Capture currently enabled scale and arpeggio IDs
    enabled_scale_ids = [s.id for s in db.query(Scale).filter(Scale.enabled).all()]
    enabled_arpeggio_ids = [a.id for a in db.query(Arpeggio).filter(Arpeggio.enabled).all()]

    selection_set = SelectionSet(
        name=request.name,
        scale_ids=enabled_scale_ids,
        arpeggio_ids=enabled_arpeggio_ids,
    )
    db.add(selection_set)
    db.commit()
    db.refresh(selection_set)
    return selection_set


@router.get("/selection-sets/active", response_model=SelectionSetResponse | None)
async def get_active_selection_set(db: Session = Depends(get_db)):
    """Get the currently active selection set, or null if none is active."""
    active = db.query(SelectionSet).filter(SelectionSet.is_active).first()
    return active


@router.put("/selection-sets/{set_id}", response_model=SelectionSetResponse)
async def update_selection_set(
    set_id: int, request: SelectionSetUpdate, db: Session = Depends(get_db)
):
    """Update a selection set's name or selection."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    if request.name is not None:
        # Check for duplicate name (excluding self)
        existing = (
            db.query(SelectionSet)
            .filter(SelectionSet.name == request.name, SelectionSet.id != set_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Selection set '{request.name}' already exists",
            )
        selection_set.name = request.name

    if request.update_from_current:
        # Capture currently enabled items
        selection_set.scale_ids = [s.id for s in db.query(Scale).filter(Scale.enabled).all()]
        selection_set.arpeggio_ids = [
            a.id for a in db.query(Arpeggio).filter(Arpeggio.enabled).all()
        ]
    else:
        if request.scale_ids is not None:
            selection_set.scale_ids = request.scale_ids
        if request.arpeggio_ids is not None:
            selection_set.arpeggio_ids = request.arpeggio_ids

    db.commit()
    db.refresh(selection_set)
    return selection_set


@router.delete("/selection-sets/{set_id}")
async def delete_selection_set(set_id: int, db: Session = Depends(get_db)):
    """Delete a selection set."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    db.delete(selection_set)
    db.commit()
    return {"message": "Selection set deleted"}


@router.post("/selection-sets/deactivate")
async def deactivate_selection_sets(db: Session = Depends(get_db)):
    """Deactivate all selection sets and disable all scales/arpeggios."""
    db.query(SelectionSet).filter(SelectionSet.is_active).update(
        {"is_active": False}, synchronize_session=False
    )
    db.query(Scale).update({"enabled": False}, synchronize_session=False)
    db.query(Arpeggio).update({"enabled": False}, synchronize_session=False)
    db.commit()
    return {"message": "All selection sets deactivated, all items disabled"}


@router.post("/selection-sets/{set_id}/load")
async def load_selection_set(set_id: int, db: Session = Depends(get_db)):
    """Load a selection set: enable its items, disable others, mark as active."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    # Deactivate all other selection sets
    db.query(SelectionSet).filter(SelectionSet.is_active).update(
        {"is_active": False}, synchronize_session=False
    )

    # Disable all scales and arpeggios first
    db.query(Scale).update({"enabled": False}, synchronize_session=False)
    db.query(Arpeggio).update({"enabled": False}, synchronize_session=False)

    # Enable the scales and arpeggios in this set
    scales_enabled = 0
    if selection_set.scale_ids:
        scales_enabled = (
            db.query(Scale)
            .filter(Scale.id.in_(selection_set.scale_ids))
            .update({"enabled": True}, synchronize_session=False)
        )

    arpeggios_enabled = 0
    if selection_set.arpeggio_ids:
        arpeggios_enabled = (
            db.query(Arpeggio)
            .filter(Arpeggio.id.in_(selection_set.arpeggio_ids))
            .update({"enabled": True}, synchronize_session=False)
        )

    # Mark this set as active
    selection_set.is_active = True

    db.commit()

    return {
        "message": "Selection set loaded",
        "scales_enabled": scales_enabled,
        "arpeggios_enabled": arpeggios_enabled,
    }
