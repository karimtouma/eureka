# Eureka

**Discover equations from your data using genetic programming**

Eureka is an open-source symbolic regression platform inspired by Eureqa. It uses evolutionary algorithms to automatically discover mathematical equations that describe your data, finding the optimal trade-off between accuracy and simplicity.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-16+-black.svg)

## Features

- **Symbolic Regression**: Automatically discover interpretable mathematical equations from data
- **Real-time Evolution**: Watch equations evolve in real-time via WebSocket streaming
- **Pareto Front Visualization**: Explore the trade-off between model accuracy and complexity
- **Customizable Operators**: Choose which mathematical operators and functions to include
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **LaTeX Rendering**: Beautiful equation display with KaTeX

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Recharts, Framer Motion |
| Backend | FastAPI, Python 3.11+, DEAP (Distributed Evolutionary Algorithms) |
| Communication | REST API + WebSockets for real-time updates |

## Quick Start

### Using Docker (Recommended)

```bash
git clone https://github.com/karimtouma/eureka.git
cd eureka
docker compose up --build
```

Access the application:
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Usage

### 1. Load Data
Upload a CSV file or input data manually. Select which columns to use as features (X) and which as the target variable (Y).

### 2. Configure Evolution
Choose the mathematical building blocks for equation discovery:
- **Operators**: +, -, *, /, ^
- **Functions**: sin, cos, sqrt, log, exp

Adjust evolution parameters:
- Population size
- Number of generations
- Mutation and crossover rates

### 3. Run & Analyze
Start the evolution and watch equations improve in real-time. The Pareto front visualization helps you find the best balance between accuracy (fitness) and complexity (equation length).

## Project Structure

```
eureka/
├── frontend/                 # Next.js application
│   ├── app/                  # App router pages
│   │   ├── data/             # Data upload & configuration
│   │   ├── functions/        # Operator & parameter selection
│   │   └── results/          # Evolution results & visualization
│   ├── components/           # React components
│   ├── hooks/                # Custom hooks (WebSocket, etc.)
│   └── lib/                  # Utilities & state management
│
├── backend/                  # FastAPI server
│   ├── api/
│   │   ├── routes/           # REST endpoints
│   │   └── websockets/       # WebSocket handlers
│   └── gp/                   # Genetic programming engine
│       ├── engine.py         # Main evolution loop
│       ├── fitness.py        # Fitness evaluation
│       ├── primitives.py     # Operators & functions
│       └── checkpoint.py     # Evolution state management
│
├── docker-compose.yml
└── Makefile
```

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data/upload/csv` | Upload CSV file |
| POST | `/api/data/upload/json` | Upload JSON data |
| GET | `/api/data/current` | Get current dataset |
| POST | `/api/data/configure` | Configure feature/target columns |
| POST | `/api/evolution/start` | Start evolution process |
| GET | `/api/evolution/status/{id}` | Get evolution status |
| GET | `/api/evolution/results/{id}` | Get final results |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws/evolution/{id}` | Real-time evolution progress |

## How It Works

Eureka uses **genetic programming**, a form of evolutionary computation, to search for mathematical expressions:

1. **Initialization**: Generate a random population of equation trees
2. **Evaluation**: Measure each equation's fitness (how well it fits the data)
3. **Selection**: Choose the best-performing equations
4. **Crossover**: Combine parts of good equations to create new ones
5. **Mutation**: Randomly modify equations to explore new solutions
6. **Repeat**: Iterate until convergence or generation limit

The algorithm maintains a **Pareto front** of non-dominated solutions, giving you equations at different complexity levels.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Eureqa](https://en.wikipedia.org/wiki/Eureqa) by Nutonian
- Built with [DEAP](https://github.com/DEAP/deap) - Distributed Evolutionary Algorithms in Python
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
# Deployment test Mon Dec  8 03:35:36 UTC 2025
