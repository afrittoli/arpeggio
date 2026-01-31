from sqlalchemy.orm import Session

from models import DEFAULT_ALGORITHM_CONFIG, Arpeggio, Scale, Setting

NOTES = ["A", "B", "C", "D", "E", "F", "G"]
ACCIDENTALS = [None, "flat", "sharp"]
SCALE_TYPES = ["major", "minor_harmonic", "minor_melodic", "chromatic"]
SCALE_OCTAVES = [1, 2, 3]
ARPEGGIO_TYPES = ["major", "minor", "diminished", "dominant"]
ARPEGGIO_OCTAVES = [2, 3]


def init_scales_and_arpeggios(db: Session) -> dict:
    """Initialize the database with all possible scale and arpeggio combinations."""

    # Check if already initialized
    existing_scales = db.query(Scale).count()
    existing_arpeggios = db.query(Arpeggio).count()

    if existing_scales > 0 and existing_arpeggios > 0:
        return {
            "message": "Database already initialized",
            "scales": existing_scales,
            "arpeggios": existing_arpeggios,
        }

    scales_created = 0
    arpeggios_created = 0

    # Create all scale combinations
    for note in NOTES:
        for accidental in ACCIDENTALS:
            for scale_type in SCALE_TYPES:
                for octaves in SCALE_OCTAVES:
                    scale = Scale(
                        note=note,
                        accidental=accidental,
                        type=scale_type,
                        octaves=octaves,
                        enabled=False,
                        weight=1.0,
                    )
                    db.add(scale)
                    scales_created += 1

    # Create all arpeggio combinations
    for note in NOTES:
        for accidental in ACCIDENTALS:
            for arpeggio_type in ARPEGGIO_TYPES:
                for octaves in ARPEGGIO_OCTAVES:
                    arpeggio = Arpeggio(
                        note=note,
                        accidental=accidental,
                        type=arpeggio_type,
                        octaves=octaves,
                        enabled=False,
                        weight=1.0,
                    )
                    db.add(arpeggio)
                    arpeggios_created += 1

    # Initialize default algorithm settings if not present
    existing_setting = db.query(Setting).filter(Setting.key == "selection_algorithm").first()
    if not existing_setting:
        setting = Setting(key="selection_algorithm", value=DEFAULT_ALGORITHM_CONFIG)
        db.add(setting)

    db.commit()

    return {
        "message": "Database initialized successfully",
        "scales": scales_created,
        "arpeggios": arpeggios_created,
    }
