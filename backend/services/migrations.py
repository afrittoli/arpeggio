"""Database schema migration framework.

This module provides a lightweight migration system for upgrading the database
schema without losing existing data. Migrations are idempotent and can be
safely run multiple times.
"""

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from models import Arpeggio, SchemaVersion

# Current schema version - increment when adding new migrations
CURRENT_SCHEMA_VERSION = 1

# Migration definitions
MIGRATIONS = {
    1: "Add 1-octave arpeggios",
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

    results["final_version"] = current_version
    return results
