from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import DEFAULT_ALGORITHM_CONFIG, Setting

router = APIRouter()


class AlgorithmConfigResponse(BaseModel):
    config: dict[str, Any]


class AlgorithmConfigUpdate(BaseModel):
    config: dict[str, Any]


@router.get("/settings/algorithm", response_model=AlgorithmConfigResponse)
async def get_algorithm_config(db: Session = Depends(get_db)):
    """Get the current selection algorithm configuration."""
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()

    if not setting:
        # Return default config if not set
        return AlgorithmConfigResponse(config=DEFAULT_ALGORITHM_CONFIG)

    return AlgorithmConfigResponse(config=setting.value)


@router.put("/settings/algorithm", response_model=AlgorithmConfigResponse)
async def update_algorithm_config(update: AlgorithmConfigUpdate, db: Session = Depends(get_db)):
    """Update the selection algorithm configuration."""
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()

    if not setting:
        setting = Setting(key="selection_algorithm", value=update.config)
        db.add(setting)
    else:
        setting.value = update.config

    db.commit()
    db.refresh(setting)

    return AlgorithmConfigResponse(config=setting.value)


@router.post("/settings/algorithm/reset", response_model=AlgorithmConfigResponse)
async def reset_algorithm_config(db: Session = Depends(get_db)):
    """Reset the selection algorithm configuration to defaults."""
    setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()

    if not setting:
        setting = Setting(key="selection_algorithm", value=DEFAULT_ALGORITHM_CONFIG)
        db.add(setting)
    else:
        setting.value = DEFAULT_ALGORITHM_CONFIG

    db.commit()
    db.refresh(setting)

    return AlgorithmConfigResponse(config=setting.value)
