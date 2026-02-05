from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Scale(Base):
    __tablename__ = "scales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    note: Mapped[str] = mapped_column(String, nullable=False)  # A, B, C, D, E, F, G
    accidental: Mapped[str | None] = mapped_column(String, nullable=True)  # flat, sharp, or None
    type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # major, minor_harmonic, minor_melodic, chromatic
    octaves: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, or 3
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    target_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Target metronome BPM
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def display_name(self) -> str:
        acc_symbol = {"flat": "♭", "sharp": "♯"}.get(self.accidental or "", "")
        type_display = self.type.replace("_", " ")
        return f"{self.note}{acc_symbol} {type_display} - {self.octaves} octave{'s' if self.octaves > 1 else ''}"


class Arpeggio(Base):
    __tablename__ = "arpeggios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    note: Mapped[str] = mapped_column(String, nullable=False)  # A, B, C, D, E, F, G
    accidental: Mapped[str | None] = mapped_column(String, nullable=True)  # flat, sharp, or None
    type: Mapped[str] = mapped_column(String, nullable=False)  # major, minor, diminished, dominant
    octaves: Mapped[int] = mapped_column(Integer, nullable=False)  # 2 or 3
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    target_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Target metronome BPM
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def display_name(self) -> str:
        acc_symbol = {"flat": "♭", "sharp": "♯"}.get(self.accidental or "", "")
        return f"{self.note}{acc_symbol} {self.type} arpeggio - {self.octaves} octaves"


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entries: Mapped[list["PracticeEntry"]] = relationship("PracticeEntry", back_populates="session")


class PracticeEntry(Base):
    __tablename__ = "practice_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("practice_sessions.id"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(String, nullable=False)  # scale or arpeggio
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    articulation: Mapped[str | None] = mapped_column(
        String, nullable=True
    )  # slurred or separate (suggested)
    was_practiced: Mapped[bool] = mapped_column(Boolean, default=False)
    practiced_slurred: Mapped[bool] = mapped_column(Boolean, default=False)
    practiced_separate: Mapped[bool] = mapped_column(Boolean, default=False)
    practiced_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Metronome BPM used
    target_bpm: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # Target BPM at practice time
    matched_target_bpm: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True
    )  # Whether practiced matched target
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["PracticeSession"] = relationship("PracticeSession", back_populates="entries")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    value: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class SchemaVersion(Base):
    __tablename__ = "schema_versions"

    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    description: Mapped[str] = mapped_column(String, nullable=False)


# Default algorithm configuration
# Each slot has a target percent (must sum to 100)
# variation controls the randomness range (±variation/2 around target)
DEFAULT_ALGORITHM_CONFIG: dict[str, Any] = {
    "total_items": 5,
    "variation": 20,
    "slots": [
        {
            "name": "Tonal Scales",
            "types": ["major", "minor_harmonic", "minor_melodic"],
            "item_type": "scale",
            "percent": 30,
        },
        {"name": "Chromatic Scales", "types": ["chromatic"], "item_type": "scale", "percent": 10},
        {
            "name": "Seventh Arpeggios",
            "types": ["diminished", "dominant"],
            "item_type": "arpeggio",
            "percent": 10,
        },
        {
            "name": "Triad Arpeggios",
            "types": ["major", "minor"],
            "item_type": "arpeggio",
            "percent": 50,
        },
    ],
    "octave_variety": True,
    "slurred_percent": 50,  # Percentage of items suggested as slurred (vs separate)
    "weighting": {
        "base_multiplier": 1.0,
        "days_since_practice_factor": 7,
        "practice_count_divisor": 1,
    },
    "default_scale_bpm": 60,  # Default metronome BPM for scales (stored as quaver)
    "default_arpeggio_bpm": 72,  # Default metronome BPM for arpeggios (stored as quaver)
    "scale_bpm_unit": "quaver",  # Display unit for scales: "quaver" or "crotchet"
    "arpeggio_bpm_unit": "quaver",  # Display unit for arpeggios: "quaver" or "crotchet"
    "weekly_focus": {
        "enabled": False,
        "keys": [],  # e.g., ["A", "B"]
        "types": [],  # e.g., ["dominant", "diminished", "chromatic"]
        "categories": [],  # e.g., ["scale", "arpeggio"]
        "probability_increase": 80,  # 0-100
    },
}
