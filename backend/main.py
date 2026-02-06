from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, init_db
from routes import arpeggios, practice, scales, selection_sets, settings
from services.migrations import run_migrations
from static_server import setup_static_serving


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup: initialize database tables
    init_db()

    # Run any pending migrations
    db = SessionLocal()
    try:
        run_migrations(db)
    finally:
        db.close()

    yield
    # Shutdown: nothing to do


app = FastAPI(
    title="Cello Scales Practice API",
    description="API for managing and practicing cello scales and arpeggios",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(scales.router, prefix="/api", tags=["scales"])
app.include_router(arpeggios.router, prefix="/api", tags=["arpeggios"])
app.include_router(practice.router, prefix="/api", tags=["practice"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(selection_sets.router, prefix="/api", tags=["selection-sets"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# Static file serving for production (must be registered last)
setup_static_serving(app)
