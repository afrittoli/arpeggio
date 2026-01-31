# Development Guide

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- npm 9 or higher

## Project Structure

```
scales/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # SQLAlchemy models
│   ├── database.py          # Database configuration
│   ├── routes/
│   │   ├── scales.py        # Scale CRUD endpoints
│   │   ├── arpeggios.py     # Arpeggio CRUD endpoints
│   │   ├── practice.py      # Practice session endpoints
│   │   └── settings.py      # Algorithm settings endpoints
│   ├── services/
│   │   ├── initializer.py   # Database initialization
│   │   └── selector.py      # Selection algorithm
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main application component
│   │   ├── api/client.ts    # API client functions
│   │   ├── types/index.ts   # TypeScript type definitions
│   │   └── pages/
│   │       ├── ConfigPage.tsx
│   │       └── PracticePage.tsx
│   ├── vite.config.ts       # Vite configuration with PWA
│   └── package.json
└── scales.db                # SQLite database (created at runtime)
```

## Backend Setup

### Create a Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Install Development Dependencies

```bash
pip install ruff mypy pytest pytest-asyncio httpx
```

### Run the Development Server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000

### API Documentation

FastAPI provides automatic API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Running Backend Tests

```bash
pytest
```

### Linting and Type Checking

```bash
ruff check .
ruff format .
mypy .
```

## Frontend Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Run the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Building for Production

```bash
npm run build
```

The built files will be in `frontend/dist/`

### Running Frontend Tests

```bash
npm run test
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

## Pre-commit Hooks

Install pre-commit hooks to run linting automatically:

```bash
pip install pre-commit
pre-commit install
```

Run hooks manually:

```bash
pre-commit run --all-files
```

## Database

The application uses SQLite. The database file (`scales.db`) is created automatically when the backend starts.

### Resetting the Database

Delete `scales.db` and restart the backend. The database will be recreated with default data.

### Database Schema

- **scales**: All possible scale combinations
- **arpeggios**: All possible arpeggio combinations
- **practice_sessions**: Practice session records
- **practice_entries**: Individual items in each session
- **settings**: Algorithm configuration (JSON)

## Environment Variables

Currently, no environment variables are required. The backend runs with default settings.

## PWA Development

The frontend is configured as a Progressive Web App. In development mode, the service worker is disabled. To test PWA functionality:

1. Build the frontend: `npm run build`
2. Serve the built files: `npm run preview`
3. Open in browser and test installation

## Troubleshooting

### Backend won't start

- Check Python version: `python --version` (needs 3.11+)
- Ensure you're in the virtual environment
- Check if port 8000 is available

### Frontend won't connect to backend

- Ensure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Check browser console for errors

### Database errors

- Delete `scales.db` and restart the backend
- Check file permissions in the project directory
