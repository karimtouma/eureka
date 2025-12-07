"""Data API Routes"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import io

router = APIRouter()

# In-memory storage for dataset
current_dataset: Optional[pd.DataFrame] = None
current_config: Optional[Dict[str, Any]] = None


# ============================================
# Request/Response Models
# ============================================

class DatasetInfo(BaseModel):
    columns: List[str]
    rows: int
    preview: List[Dict[str, Any]]


class DatasetUpload(BaseModel):
    data: List[Dict[str, Any]]
    columns: List[str]


class ColumnConfig(BaseModel):
    features: List[str]  # X columns
    target: str  # Y column


# ============================================
# API Endpoints
# ============================================

@router.post("/upload/csv")
async def upload_csv(file: UploadFile = File(...)) -> DatasetInfo:
    """Upload a CSV file and store it in memory."""
    global current_dataset
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        current_dataset = df
        
        return DatasetInfo(
            columns=list(df.columns),
            rows=len(df),
            preview=df.head(10).to_dict(orient='records')
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")


@router.post("/upload/json")
async def upload_json(data: DatasetUpload) -> DatasetInfo:
    """Upload data as JSON (from grid editor)."""
    global current_dataset
    
    try:
        df = pd.DataFrame(data.data)
        # Ensure columns are in the right order
        if data.columns:
            df = df[data.columns]
        current_dataset = df
        
        return DatasetInfo(
            columns=list(df.columns),
            rows=len(df),
            preview=df.head(10).to_dict(orient='records')
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creating dataset: {str(e)}")


@router.get("/current")
async def get_current_dataset() -> Dict[str, Any]:
    """Get the current dataset."""
    global current_dataset
    
    if current_dataset is None:
        return {"data": [], "columns": [], "rows": 0}
    
    return {
        "data": current_dataset.to_dict(orient='records'),
        "columns": list(current_dataset.columns),
        "rows": len(current_dataset)
    }


@router.post("/configure")
async def configure_columns(config: ColumnConfig) -> Dict[str, Any]:
    """Configure which columns are features (X) and target (Y).
    
    Returns plain dict to avoid Pydantic validation issues.
    """
    global current_dataset, current_config
    
    if current_dataset is None:
        raise HTTPException(status_code=400, detail="No dataset loaded")
    
    # Validate columns exist
    all_cols = set(config.features + [config.target])
    missing = all_cols - set(current_dataset.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Columns not found: {missing}")
    
    # Store configuration
    current_config = {
        "features": config.features,
        "target": config.target
    }
    
    return {
        "status": "configured",
        "features": config.features,
        "target": config.target
    }


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get the current column configuration."""
    global current_config
    
    if current_config is None:
        return {"configured": False}
    
    return {
        "configured": True,
        **current_config
    }


@router.delete("/clear")
async def clear_dataset() -> Dict[str, str]:
    """Clear the current dataset."""
    global current_dataset, current_config
    current_dataset = None
    current_config = None
    return {"status": "cleared"}
