from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes import arpeggios, practice, scales, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database
    init_db()
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


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
