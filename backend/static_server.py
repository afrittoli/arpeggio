"""Static file serving for production deployment."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def setup_static_serving(app: FastAPI) -> None:
    """Configure static file serving if static directory exists."""
    static_dir = Path(__file__).parent / "static"

    if not static_dir.exists():
        return

    # Serve assets directory
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        static_files = StaticFiles(directory=str(assets_dir))
        app.mount("/assets", static_files, name="assets")

    @app.get("/")
    async def serve_index() -> FileResponse:
        return FileResponse(static_dir / "index.html")

    @app.get("/{path:path}")
    async def serve_frontend(path: str) -> FileResponse:
        # Try to serve the exact file
        file_path = static_dir / path
        if file_path.is_file():
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(static_dir / "index.html")
