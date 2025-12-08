# Eureka - Claude Code Context

## Project Overview

Eureka is a symbolic regression platform that uses genetic programming to discover mathematical equations from data. It's inspired by Eureqa and built with a modern tech stack.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, Python 3.11+, DEAP, NumPy, Pandas |
| Communication | REST API + WebSockets |
| Infrastructure | Docker, Docker Compose |

## Project Structure

```
eureka/
├── frontend/           # Next.js application
│   ├── app/            # App router (pages)
│   │   ├── data/       # Data upload & configuration
│   │   ├── functions/  # Operator selection
│   │   └── results/    # Evolution visualization
│   ├── components/     # Reusable React components
│   ├── hooks/          # Custom hooks (WebSocket, etc.)
│   └── lib/            # State management (Zustand)
│
├── backend/            # FastAPI server
│   ├── api/
│   │   ├── routes/     # REST endpoints
│   │   └── websockets/ # Real-time handlers
│   └── gp/             # Genetic programming engine
│       ├── engine.py   # Evolution loop
│       ├── fitness.py  # Fitness evaluation
│       └── primitives.py # Math operators
```

## Development Commands

```bash
# Start development (Docker)
make dev

# Rebuild containers
make dev-build

# View logs
make logs

# Clean everything
make clean

# Backend only (local)
cd backend && uvicorn main:app --reload --port 8000

# Frontend only (local)
cd frontend && npm run dev
```

## Code Style Guidelines

### Python (Backend)
- Follow PEP 8
- Use type hints for all functions
- Write docstrings for public APIs
- Keep functions < 50 lines

### TypeScript (Frontend)
- Strict mode enabled
- Functional components with hooks
- Props interfaces for all components
- Use Zustand for global state

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data/upload/csv` | Upload CSV file |
| POST | `/api/data/upload/json` | Upload JSON data |
| GET | `/api/data/current` | Get current dataset |
| POST | `/api/data/configure` | Configure columns |
| POST | `/api/evolution/start` | Start evolution |
| GET | `/api/evolution/status/{id}` | Evolution status |
| WS | `/ws/evolution/{id}` | Real-time updates |

## Testing

```bash
# Backend tests
cd backend && python -m pytest

# Frontend linting
cd frontend && npm run lint
```

## Key Concepts

- **Symbolic Regression**: Finding mathematical expressions that fit data
- **Genetic Programming**: Evolutionary algorithm using tree-based representations
- **Pareto Front**: Set of non-dominated solutions (accuracy vs complexity trade-off)
- **DEAP**: Python library for evolutionary algorithms

## Important Notes

- WebSocket connections are used for real-time evolution progress
- The frontend uses Zustand for state management (see `lib/store.ts`)
- Evolution runs asynchronously in the backend
- KaTeX is used for LaTeX equation rendering
