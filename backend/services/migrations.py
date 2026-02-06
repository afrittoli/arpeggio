"""Database schema migration framework.

This module provides a lightweight migration system for upgrading the database
schema without losing existing data. Migrations are idempotent and can be
safely run multiple times.
"""

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from models import Arpeggio, SchemaVersion

# Current schema version - increment when adding new migrations
CURRENT_SCHEMA_VERSION = 6

# Migration definitions
MIGRATIONS = {
    1: "Add 1-octave arpeggios",
    2: "Add articulation columns to practice_entries",
    3: "Add practiced_bpm column to practice_entries",
    4: "Add target_bpm column to scales and arpeggios",
    5: "Add target_bpm and matched_target_bpm to practice_entries",
    6: "Add selection_sets table and selection_set_id to practice_sessions",
}

# Constants for arpeggio generation (must match initializer.py)
NOTES = ["A", "B", "C", "D", "E", "F", "G"]
ACCIDENTALS = [None, "flat", "sharp"]
ARPEGGIO_TYPES = ["major", "minor", "diminished", "dominant"]


def get_current_version(db: Session) -> int:
    """Get current schema version from database.

    Returns 0 if the schema_versions table doesn't exist or is empty
    (indicating an unversioned database).
    """
    inspector = inspect(db.get_bind())

    # Check if schema_versions table exists
    if "schema_versions" not in inspector.get_table_names():
        return 0

    # Get the highest version number
    result = db.execute(text("SELECT MAX(version) FROM schema_versions")).scalar()

    return result if result is not None else 0


def record_migration(db: Session, version: int, description: str) -> None:
    """Record a completed migration in the schema_versions table."""
    migration = SchemaVersion(version=version, description=description)
    db.add(migration)
    db.commit()


def migrate_v0_to_v1(db: Session) -> int:
    """Migration v0 → v1: Add 1-octave arpeggios.

    This migration adds 1-octave versions for all arpeggio combinations
    that only have 2 and 3 octave versions.

    Returns the number of arpeggios added.
    """
    added_count = 0

    # Get all existing 1-octave arpeggios to check what already exists
    existing_one_octave = set()
    one_octave_arpeggios = db.query(Arpeggio).filter(Arpeggio.octaves == 1).all()
    for arp in one_octave_arpeggios:
        existing_one_octave.add((arp.note, arp.accidental, arp.type))

    # Add missing 1-octave arpeggios
    for note in NOTES:
        for accidental in ACCIDENTALS:
            for arpeggio_type in ARPEGGIO_TYPES:
                key = (note, accidental, arpeggio_type)
                if key not in existing_one_octave:
                    arpeggio = Arpeggio(
                        note=note,
                        accidental=accidental,
                        type=arpeggio_type,
                        octaves=1,
                        enabled=False,
                        weight=1.0,
                    )
                    db.add(arpeggio)
                    added_count += 1

    db.commit()
    return added_count


def migrate_v1_to_v2(db: Session) -> dict:
    """Migration v1 → v2: Add articulation columns to practice_entries.

    Adds three columns:
    - articulation: suggested articulation (slurred/separate)
    - practiced_slurred: whether item was practiced slurred
    - practiced_separate: whether item was practiced separate

    Returns dict with columns added.
    """
    inspector = inspect(db.get_bind())
    existing_columns = {col["name"] for col in inspector.get_columns("practice_entries")}

    columns_added = []

    # Add articulation column if not exists
    if "articulation" not in existing_columns:
        db.execute(text("ALTER TABLE practice_entries ADD COLUMN articulation VARCHAR"))
        columns_added.append("articulation")

    # Add practiced_slurred column if not exists
    if "practiced_slurred" not in existing_columns:
        db.execute(
            text("ALTER TABLE practice_entries ADD COLUMN practiced_slurred BOOLEAN DEFAULT 0")
        )
        columns_added.append("practiced_slurred")

    # Add practiced_separate column if not exists
    if "practiced_separate" not in existing_columns:
        db.execute(
            text("ALTER TABLE practice_entries ADD COLUMN practiced_separate BOOLEAN DEFAULT 0")
        )
        columns_added.append("practiced_separate")

    db.commit()
    return {"columns_added": columns_added}


def migrate_v2_to_v3(db: Session) -> dict:
    """Migration v2 → v3: Add practiced_bpm column to practice_entries.

    Adds column for recording metronome BPM used during practice.

    Returns dict with columns added.
    """
    inspector = inspect(db.get_bind())
    existing_columns = {col["name"] for col in inspector.get_columns("practice_entries")}

    columns_added = []

    # Add practiced_bpm column if not exists
    if "practiced_bpm" not in existing_columns:
        db.execute(text("ALTER TABLE practice_entries ADD COLUMN practiced_bpm INTEGER"))
        columns_added.append("practiced_bpm")

    db.commit()
    return {"columns_added": columns_added}


def migrate_v3_to_v4(db: Session) -> dict:
    """Migration v3 → v4: Add target_bpm column to scales and arpeggios.

    Adds column for setting target metronome BPM per scale/arpeggio.
    When NULL, the global default BPM from algorithm config is used.

    Returns dict with columns added.
    """
    inspector = inspect(db.get_bind())
    columns_added = []

    # Add target_bpm to scales
    scale_columns = {col["name"] for col in inspector.get_columns("scales")}
    if "target_bpm" not in scale_columns:
        db.execute(text("ALTER TABLE scales ADD COLUMN target_bpm INTEGER"))
        columns_added.append("scales.target_bpm")

    # Add target_bpm to arpeggios
    arpeggio_columns = {col["name"] for col in inspector.get_columns("arpeggios")}
    if "target_bpm" not in arpeggio_columns:
        db.execute(text("ALTER TABLE arpeggios ADD COLUMN target_bpm INTEGER"))
        columns_added.append("arpeggios.target_bpm")

    db.commit()
    return {"columns_added": columns_added}


def migrate_v4_to_v5(db: Session) -> dict:
    """Migration v4 → v5: Add target_bpm and matched_target_bpm to practice_entries.

    Adds columns for tracking target BPM at practice time and whether it matched.

    Returns dict with columns added.
    """
    inspector = inspect(db.get_bind())
    existing_columns = {col["name"] for col in inspector.get_columns("practice_entries")}
    columns_added = []

    if "target_bpm" not in existing_columns:
        db.execute(text("ALTER TABLE practice_entries ADD COLUMN target_bpm INTEGER"))
        columns_added.append("target_bpm")

    if "matched_target_bpm" not in existing_columns:
        db.execute(text("ALTER TABLE practice_entries ADD COLUMN matched_target_bpm BOOLEAN"))
        columns_added.append("matched_target_bpm")

    db.commit()
    return {"columns_added": columns_added}


def migrate_v5_to_v6(db: Session) -> dict:
    """Migration v5 -> v6: Add selection_sets table and selection_set_id.

    Creates the selection_sets table for storing named repertoire selections.
    Adds selection_set_id foreign key to practice_sessions.

    Returns dict with tables and columns created.
    """
    inspector = inspect(db.get_bind())
    tables_created = []
    columns_added = []

    # Create selection_sets table if it doesn't exist
    if "selection_sets" not in inspector.get_table_names():
        db.execute(
            text(
                """
                CREATE TABLE selection_sets (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    is_active BOOLEAN DEFAULT 0,
                    scale_ids JSON DEFAULT '[]',
                    arpeggio_ids JSON DEFAULT '[]',
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        tables_created.append("selection_sets")

    # Add selection_set_id to practice_sessions if it doesn't exist
    session_columns = {col["name"] for col in inspector.get_columns("practice_sessions")}
    if "selection_set_id" not in session_columns:
        db.execute(
            text(
                "ALTER TABLE practice_sessions ADD COLUMN selection_set_id INTEGER "
                "REFERENCES selection_sets(id)"
            )
        )
        columns_added.append("practice_sessions.selection_set_id")

    db.commit()
    return {"tables_created": tables_created, "columns_added": columns_added}


def run_migrations(db: Session) -> dict:
    """Run all pending migrations.

    Checks the current schema version and applies any migrations
    that haven't been run yet.

    Returns a dict with migration results.
    """
    current_version = get_current_version(db)
    migrations_applied: list[dict] = []
    results = {
        "initial_version": current_version,
        "final_version": current_version,
        "migrations_applied": migrations_applied,
    }

    # Apply each pending migration in order
    if current_version < 1:
        added = migrate_v0_to_v1(db)
        record_migration(db, 1, MIGRATIONS[1])
        migrations_applied.append(
            {
                "version": 1,
                "description": MIGRATIONS[1],
                "arpeggios_added": added,
            }
        )
        current_version = 1

    if current_version < 2:
        result = migrate_v1_to_v2(db)
        record_migration(db, 2, MIGRATIONS[2])
        migrations_applied.append(
            {
                "version": 2,
                "description": MIGRATIONS[2],
                **result,
            }
        )
        current_version = 2

    if current_version < 3:
        result = migrate_v2_to_v3(db)
        record_migration(db, 3, MIGRATIONS[3])
        migrations_applied.append(
            {
                "version": 3,
                "description": MIGRATIONS[3],
                **result,
            }
        )
        current_version = 3

    if current_version < 4:
        result = migrate_v3_to_v4(db)
        record_migration(db, 4, MIGRATIONS[4])
        migrations_applied.append(
            {
                "version": 4,
                "description": MIGRATIONS[4],
                **result,
            }
        )
        current_version = 4

    if current_version < 5:
        result = migrate_v4_to_v5(db)
        record_migration(db, 5, MIGRATIONS[5])
        migrations_applied.append(
            {
                "version": 5,
                "description": MIGRATIONS[5],
                **result,
            }
        )
        current_version = 5

    if current_version < 6:
        result = migrate_v5_to_v6(db)
        record_migration(db, 6, MIGRATIONS[6])
        migrations_applied.append(
            {
                "version": 6,
                "description": MIGRATIONS[6],
                **result,
            }
        )
        current_version = 6

    results["final_version"] = current_version
    return results
