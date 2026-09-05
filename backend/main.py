"""
backend/main.py

FastAPI application — main entry point.

Endpoints:
  POST /api/analyze           - NL product query or technical specification
  POST /api/analyze/tender    - Tender document upload (PDF/DOCX)
  GET  /api/standards/{is_number}  - Standard lookup by IS number
  GET  /api/health            - Health check

Frontend:
  Serves bis_home.html and bis_main.js from the project root directory.
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Root of the project (parent of backend/)
ROOT = Path(__file__).parent.parent

app = FastAPI(
    title="BIS Procurement Standards Recommendation & Verification Assistant",
    description=(
        "AI-Powered BIS Standards Recommender for Procurement — SIH 2026 / PS 26108. "
        "Identifies applicable Indian Standards, verifies them against BIS, and explains recommendations."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class AnalyzeRequest(BaseModel):
    query: str
    input_type: str = "product_description"  # product_description | technical_specification
    language: str = "auto"
    enable_bis_discovery: bool = True


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health():
    from backend.db_client import get_standards_collection
    try:
        count = get_standards_collection().count_documents({})
        mongo_status = f"ok — {count} standards"
    except Exception as e:
        mongo_status = f"error: {e}"

    gemini_key = bool(os.getenv("GEMINI_API_KEY"))
    gemini_status = "configured" if gemini_key else "MISSING — set GEMINI_API_KEY in .env"

    return {
        "status": "ok",
        "mongodb": mongo_status,
        "gemini": gemini_status,
    }


# ============================================================
# ANALYZE — NL PRODUCT QUERY / TECHNICAL SPECIFICATION
# ============================================================

@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        from backend.services.pipeline import run_analysis
        result = run_analysis(
            query=req.query,
            input_type=req.input_type,
            enable_bis_discovery=req.enable_bis_discovery,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============================================================
# ANALYZE — TENDER DOCUMENT UPLOAD
# ============================================================

@app.post("/api/analyze/tender")
async def analyze_tender_doc(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
):
    filename = file.filename or ""
    if not (filename.lower().endswith(".pdf") or filename.lower().endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )
    try:
        file_bytes = await file.read()
        from backend.services.document_parser import extract_text
        from backend.services.pipeline import run_tender_analysis
        pages = extract_text(file_bytes, filename)
        if not pages:
            return JSONResponse(
                status_code=422,
                content={
                    "error": (
                        "Could not extract text from the document. "
                        "It may be a scanned/image-based PDF."
                    )
                },
            )
        result = run_tender_analysis(pages)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tender analysis failed: {str(e)}")


# ============================================================
# STANDARD LOOKUP
# ============================================================

@app.get("/api/standards/{is_number:path}")
async def get_standard(is_number: str):
    from backend.db_client import get_standards_collection
    from backend.services.verification import determine_verification_status
    coll = get_standards_collection()
    doc = coll.find_one(
        {"is_number": {"$regex": is_number.strip(), "$options": "i"}},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"Standard '{is_number}' not found in database.",
        )
    doc["verification"] = determine_verification_status(doc)
    return doc


# ============================================================
# FRONTEND — Serve existing HTML/JS
# ============================================================

@app.get("/")
async def serve_index():
    html_path = ROOT / "bis_home.html"
    if html_path.exists():
        return FileResponse(str(html_path), media_type="text/html")
    return JSONResponse(
        {"message": "BIS AI Backend running. Frontend file (bis_home.html) not found."}
    )


@app.get("/bis_main.js")
async def serve_js():
    js_path = ROOT / "bis_main.js"
    if js_path.exists():
        return FileResponse(str(js_path), media_type="application/javascript")
    raise HTTPException(status_code=404, detail="Frontend JS not found.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
