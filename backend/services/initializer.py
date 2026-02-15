from sqlalchemy.orm import Session

from models import DEFAULT_ALGORITHM_CONFIG, Arpeggio, Scale, SchemaVersion, Setting
from services.migrations import CURRENT_SCHEMA_VERSION, MIGRATIONS, run_migrations

NOTES = ["A", "B", "C", "D", "E", "F", "G"]
ACCIDENTALS = [None, "flat", "sharp"]
SCALE_TYPES = ["major", "minor_harmonic", "minor_melodic", "chromatic"]
SCALE_OCTAVES = [1, 2, 3]
ARPEGGIO_TYPES = ["major", "minor", "diminished", "dominant"]
ARPEGGIO_OCTAVES = [1, 2, 3]


def init_scales_and_arpeggios(db: Session) -> dict:
    """Initialize the database with all possible scale and arpeggio combinations.

    For fresh databases: Creates all entries and sets schema version.
    For existing databases: Runs any pending migrations.

    Migrations run BEFORE querying ORM models to ensure the database schema
    matches the model definitions (e.g. new columns like articulation_mode).
    """
    # Run migrations first - must happen before any ORM model queries
    # because models may reference columns that don't exist yet
    migration_result = run_migrations(db)

    # Check if already initialized
    existing_scales = db.query(Scale).count()
    existing_arpeggios = db.query(Arpeggio).count()

    if existing_scales > 0 or existing_arpeggios > 0:
        return {
            "message": "Database migrated",
            "scales": existing_scales,
            "arpeggios": existing_arpeggios,
            "migrations": migration_result,
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

    # Record schema version for fresh database
    schema_version = SchemaVersion(
        version=CURRENT_SCHEMA_VERSION,
        description=MIGRATIONS[CURRENT_SCHEMA_VERSION],
    )
    db.add(schema_version)

    db.commit()

    return {
        "message": "Database initialized successfully",
        "scales": scales_created,
        "arpeggios": arpeggios_created,
        "schema_version": CURRENT_SCHEMA_VERSION,
    }
