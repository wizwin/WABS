from fastapi import APIRouter

try:
    from backend.app.database import SessionLocal, FileIndex
except ModuleNotFoundError:
    from database import SessionLocal, FileIndex

router = APIRouter(prefix="/stats")

@router.get("/")
def stats():

    session = SessionLocal()

    return {
        "total": session.query(FileIndex).count(),
        "photos": session.query(FileIndex).filter(
            FileIndex.category == "photo"
        ).count(),
        "videos": session.query(FileIndex).filter(
            FileIndex.category == "video"
        ).count(),
        "documents": session.query(FileIndex).filter(
            FileIndex.category == "document"
        ).count()
    }