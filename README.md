# Cello Scales Practice

A web application to help cellists prepare for exams by selecting and tracking practice of scales and arpeggios.

## Features

- **Scale & Arpeggio Configuration**: Enable/disable specific scales and arpeggios for your exam grade
- **Weighted Selection**: Adjust weights to prioritize certain scales
- **Smart Practice Sets**: Generate balanced, randomized practice sets
- **Practice Tracking**: Track what you've practiced to inform future selections
- **Configurable Algorithm**: Tune the selection algorithm to your needs
- **PWA Support**: Install on mobile devices for easy access

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

### Config Mode

1. **Scales Tab**: Enable scales relevant to your exam, adjust weights for scales you want to practice more
2. **Arpeggios Tab**: Same for arpeggios
3. **Algorithm Tab**: Configure selection parameters:
   - Total items per practice set
   - Octave variety (mix different octave counts)
   - Maximum arpeggio percentage
   - Weighting parameters

### Practice Mode

1. Click "Generate Practice Set" to get a randomized selection
2. Practice each item and check it off
3. Click "Save Practice Session" to record your progress
4. View practice history to see what needs more attention

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + Vite PWA)             │
│         TypeScript, React Router, TanStack Query     │
├─────────────────────────────────────────────────────┤
│                   REST API (FastAPI)                 │
├─────────────────────────────────────────────────────┤
│                   SQLite Database                    │
└─────────────────────────────────────────────────────┘
```

## Scale Types Supported

- Major
- Minor Harmonic
- Minor Melodic
- Chromatic

## Arpeggio Types Supported

- Major
- Minor
- Diminished
- Dominant

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup instructions.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
