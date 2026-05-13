from fastapi import APIRouter
from sqlalchemy import func

try:
    from backend.app.database import SessionLocal, FileIndex
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex

router = APIRouter(prefix="/search")

@router.get("/")
def search(query: str):

    session = SessionLocal()

    results = session.query(FileIndex).filter(
        func.lower(FileIndex.filename).contains(
            query.lower()
        )
    ).limit(100).all()

    return [
        {
            "filename": r.filename,
            "path": r.path,
            "category": r.category,
            "extension": r.extension
        }
        for r in results
    ]