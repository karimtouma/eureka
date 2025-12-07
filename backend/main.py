from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import data, evolution
from api.websockets import evolution_ws

app = FastAPI(
    title="Eureka GP API",
    description="API para regresión simbólica con programación genética",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])
app.include_router(evolution_ws.router, prefix="/ws", tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Eureka GP API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

