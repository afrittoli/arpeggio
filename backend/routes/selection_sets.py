"""Routes for managing selection sets (named repertoire configurations)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from models import Arpeggio, Scale, SelectionSet

router = APIRouter()


class SelectionSetCreate(BaseModel):
    """Request model for creating a selection set."""

    name: str
    scale_ids: list[int] = []
    arpeggio_ids: list[int] = []


class SelectionSetUpdate(BaseModel):
    """Request model for updating a selection set."""

    name: str
    scale_ids: list[int] = []
    arpeggio_ids: list[int] = []


class SelectionSetResponse(BaseModel):
    """Response model for selection set data."""

    id: int
    name: str
    is_active: bool
    scale_ids: list[int]
    arpeggio_ids: list[int]
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


@router.get("/selection-sets", response_model=list[SelectionSetResponse])
async def get_selection_sets(db: Session = Depends(get_db)):
    """Get all selection sets."""
    sets = db.query(SelectionSet).order_by(SelectionSet.name).all()
    return [
        SelectionSetResponse(
            id=s.id,
            name=s.name,
            is_active=s.is_active,
            scale_ids=s.scale_ids or [],
            arpeggio_ids=s.arpeggio_ids or [],
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sets
    ]


@router.get("/selection-sets/active", response_model=SelectionSetResponse | None)
async def get_active_selection_set(db: Session = Depends(get_db)):
    """Get the currently active selection set, if any."""
    active_set = db.query(SelectionSet).filter(SelectionSet.is_active).first()
    if not active_set:
        return None
    return SelectionSetResponse(
        id=active_set.id,
        name=active_set.name,
        is_active=active_set.is_active,
        scale_ids=active_set.scale_ids or [],
        arpeggio_ids=active_set.arpeggio_ids or [],
        created_at=active_set.created_at.isoformat(),
        updated_at=active_set.updated_at.isoformat(),
    )


@router.get("/selection-sets/{set_id}", response_model=SelectionSetResponse)
async def get_selection_set(set_id: int, db: Session = Depends(get_db)):
    """Get a specific selection set by ID."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")
    return SelectionSetResponse(
        id=selection_set.id,
        name=selection_set.name,
        is_active=selection_set.is_active,
        scale_ids=selection_set.scale_ids or [],
        arpeggio_ids=selection_set.arpeggio_ids or [],
        created_at=selection_set.created_at.isoformat(),
        updated_at=selection_set.updated_at.isoformat(),
    )


@router.post("/selection-sets", response_model=SelectionSetResponse)
async def create_selection_set(data: SelectionSetCreate, db: Session = Depends(get_db)):
    """Create a new selection set."""
    # Check for duplicate name
    existing = db.query(SelectionSet).filter(SelectionSet.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Selection set with name '{data.name}' already exists",
        )

    selection_set = SelectionSet(
        name=data.name,
        scale_ids=data.scale_ids,
        arpeggio_ids=data.arpeggio_ids,
    )
    db.add(selection_set)
    db.commit()
    db.refresh(selection_set)

    return SelectionSetResponse(
        id=selection_set.id,
        name=selection_set.name,
        is_active=selection_set.is_active,
        scale_ids=selection_set.scale_ids or [],
        arpeggio_ids=selection_set.arpeggio_ids or [],
        created_at=selection_set.created_at.isoformat(),
        updated_at=selection_set.updated_at.isoformat(),
    )


@router.put("/selection-sets/{set_id}", response_model=SelectionSetResponse)
async def update_selection_set(
    set_id: int, data: SelectionSetUpdate, db: Session = Depends(get_db)
):
    """Update an existing selection set."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    # Check for duplicate name (excluding this set)
    existing = (
        db.query(SelectionSet)
        .filter(SelectionSet.name == data.name, SelectionSet.id != set_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Selection set with name '{data.name}' already exists",
        )

    selection_set.name = data.name
    selection_set.scale_ids = data.scale_ids
    selection_set.arpeggio_ids = data.arpeggio_ids
    db.commit()
    db.refresh(selection_set)

    return SelectionSetResponse(
        id=selection_set.id,
        name=selection_set.name,
        is_active=selection_set.is_active,
        scale_ids=selection_set.scale_ids or [],
        arpeggio_ids=selection_set.arpeggio_ids or [],
        created_at=selection_set.created_at.isoformat(),
        updated_at=selection_set.updated_at.isoformat(),
    )


@router.delete("/selection-sets/{set_id}")
async def delete_selection_set(set_id: int, db: Session = Depends(get_db)):
    """Delete a selection set."""
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    db.delete(selection_set)
    db.commit()
    return {"deleted": True}


@router.post("/selection-sets/{set_id}/load")
async def load_selection_set(set_id: int, db: Session = Depends(get_db)):
    """Load a selection set, enabling its items and disabling others.

    This operation:
    1. Deactivates all other selection sets
    2. Marks this selection set as active
    3. Enables all scales and arpeggios in the set
    4. Disables all scales and arpeggios not in the set
    """
    selection_set = db.query(SelectionSet).filter(SelectionSet.id == set_id).first()
    if not selection_set:
        raise HTTPException(status_code=404, detail="Selection set not found")

    # Deactivate all selection sets
    db.query(SelectionSet).update({"is_active": False})

    # Activate this set
    selection_set.is_active = True

    # Get the IDs from the set
    scale_ids_set = set(selection_set.scale_ids or [])
    arpeggio_ids_set = set(selection_set.arpeggio_ids or [])

    # Enable scales in the set, disable others
    scales_enabled = 0
    scales_disabled = 0
    for scale in db.query(Scale).all():
        if scale.id in scale_ids_set:
            if not scale.enabled:
                scale.enabled = True
            scales_enabled += 1
        else:
            if scale.enabled:
                scale.enabled = False
                scales_disabled += 1

    # Enable arpeggios in the set, disable others
    arpeggios_enabled = 0
    arpeggios_disabled = 0
    for arpeggio in db.query(Arpeggio).all():
        if arpeggio.id in arpeggio_ids_set:
            if not arpeggio.enabled:
                arpeggio.enabled = True
            arpeggios_enabled += 1
        else:
            if arpeggio.enabled:
                arpeggio.enabled = False
                arpeggios_disabled += 1

    db.commit()

    return {
        "loaded": True,
        "scales_enabled": scales_enabled,
        "scales_disabled": scales_disabled,
        "arpeggios_enabled": arpeggios_enabled,
        "arpeggios_disabled": arpeggios_disabled,
    }


@router.post("/selection-sets/deactivate")
async def deactivate_all_selection_sets(db: Session = Depends(get_db)):
    """Deactivate all selection sets without changing item enabled states."""
    count = db.query(SelectionSet).filter(SelectionSet.is_active).update({"is_active": False})
    db.commit()
    return {"deactivated_count": count}
