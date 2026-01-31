from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Scale(Base):
    __tablename__ = "scales"

    id = Column(Integer, primary_key=True, index=True)
    note = Column(String, nullable=False)  # A, B, C, D, E, F, G
    accidental = Column(String, nullable=True)  # flat, sharp, or None
    type = Column(String, nullable=False)  # major, minor_harmonic, minor_melodic, chromatic, diminished, dominant
    octaves = Column(Integer, nullable=False)  # 1, 2, or 3
    enabled = Column(Boolean, default=False)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def display_name(self) -> str:
        acc_symbol = {"flat": "♭", "sharp": "♯"}.get(self.accidental, "")
        type_display = self.type.replace("_", " ")
        return f"{self.note}{acc_symbol} {type_display} - {self.octaves} octave{'s' if self.octaves > 1 else ''}"


class Arpeggio(Base):
    __tablename__ = "arpeggios"

    id = Column(Integer, primary_key=True, index=True)
    note = Column(String, nullable=False)  # A, B, C, D, E, F, G
    accidental = Column(String, nullable=True)  # flat, sharp, or None
    type = Column(String, nullable=False)  # major, minor, diminished, dominant
    octaves = Column(Integer, nullable=False)  # 2 or 3
    enabled = Column(Boolean, default=False)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def display_name(self) -> str:
        acc_symbol = {"flat": "♭", "sharp": "♯"}.get(self.accidental, "")
        return f"{self.note}{acc_symbol} {self.type} arpeggio - {self.octaves} octaves"


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    entries = relationship("PracticeEntry", back_populates="session")


class PracticeEntry(Base):
    __tablename__ = "practice_entries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("practice_sessions.id"), nullable=False)
    item_type = Column(String, nullable=False)  # scale or arpeggio
    item_id = Column(Integer, nullable=False)
    was_practiced = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("PracticeSession", back_populates="entries")


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Default algorithm configuration
# Each slot has a target percent (must sum to 100)
# variation controls the randomness range (±variation/2 around target)
DEFAULT_ALGORITHM_CONFIG = {
    "total_items": 5,
    "variation": 20,
    "slots": [
        {
            "name": "Tonal Scales",
            "types": ["major", "minor_harmonic", "minor_melodic"],
            "item_type": "scale",
            "percent": 30
        },
        {
            "name": "Chromatic Scales",
            "types": ["chromatic"],
            "item_type": "scale",
            "percent": 10
        },
        {
            "name": "Seventh Arpeggios",
            "types": ["diminished", "dominant"],
            "item_type": "arpeggio",
            "percent": 10
        },
        {
            "name": "Triad Arpeggios",
            "types": ["major", "minor"],
            "item_type": "arpeggio",
            "percent": 50
        }
    ],
    "octave_variety": True,
    "weighting": {
        "base_multiplier": 1.0,
        "days_since_practice_factor": 7,
        "practice_count_divisor": 1
    }
}
