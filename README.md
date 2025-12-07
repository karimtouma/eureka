# Eureka - Symbolic Regression with Genetic Programming

Sistema de regresión simbólica inspirado en Eureqa que utiliza programación genética para descubrir ecuaciones matemáticas a partir de datos.

## Stack Tecnológico

- **Frontend**: Next.js 15+, TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI, Python 3.11+, DEAP
- **Comunicación**: REST API + WebSockets para tiempo real

## Estructura del Proyecto

```
eureka/
├── frontend/          # Next.js App
│   ├── app/
│   │   ├── data/      # Pantalla de carga de datos
│   │   ├── functions/ # Selector de funciones/operadores
│   │   └── results/   # Visualización de resultados
│   ├── components/
│   ├── hooks/
│   └── lib/
├── backend/           # FastAPI Server
│   ├── api/
│   │   ├── routes/
│   │   └── websockets/
│   └── gp/            # Motor de programación genética
└── docker-compose.yml
```

## Ejecución

### Con Docker (recomendado)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Docs API: http://localhost:8000/docs

### Desarrollo local

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Uso

1. **Data**: Carga un archivo CSV o ingresa datos manualmente. Selecciona las columnas como features (X) o target (Y).

2. **Functions**: Elige los operadores (+, -, *, /, ^) y funciones (sin, cos, sqrt, log, exp) disponibles para la evolución. Configura parámetros como población, generaciones y tasas de mutación.

3. **Results**: Inicia la evolución y observa en tiempo real cómo evolucionan las ecuaciones. Explora el Pareto front de precisión vs complejidad.

## API Endpoints

- `POST /api/data/upload/csv` - Subir archivo CSV
- `POST /api/data/upload/json` - Subir datos JSON
- `GET /api/data/current` - Obtener dataset actual
- `POST /api/data/configure` - Configurar columnas
- `POST /api/evolution/start` - Iniciar evolución
- `GET /api/evolution/status/{id}` - Estado de evolución
- `GET /api/evolution/results/{id}` - Resultados finales
- `WS /ws/evolution/{id}` - WebSocket para progreso en tiempo real

