import sys
import os
import unittest
import tempfile
import shutil
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.database import SessionLocal, FileIndex
from backend.app.config import get_thumbnail_dir
from backend.app.utils.media import generate_photo_thumbnail
from backend.app.routes.files import preview, open_file_path
from unittest.mock import patch

class TestGifPreview(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.gif_path = Path(self.temp_dir) / "test_animation.gif"
        
        # Create an animated GIF with 3 frames and transparency
        frames = []
        for color in [(255, 0, 0), (0, 255, 0), (0, 0, 255)]:
            img = Image.new("RGBA", (100, 100), (*color, 255))
            frames.append(img)
        
        frames[0].save(
            str(self.gif_path),
            save_all=True,
            append_images=frames[1:],
            duration=100,
            loop=0,
            transparency=0,
            disposal=2
        )
        
        # Insert a FileIndex record in DB
        with SessionLocal() as session:
            self.file_record = FileIndex(
                filename="test_animation.gif",
                path=str(self.gif_path),
                category="photo",
                extension=".gif",
                size=str(self.gif_path.stat().st_size)
            )
            session.add(self.file_record)
            session.commit()
            session.refresh(self.file_record)
            self.file_id = self.file_record.id

    def tearDown(self):
        # Cleanup DB
        with SessionLocal() as session:
            item = session.get(FileIndex, self.file_id)
            if item:
                session.delete(item)
                session.commit()
                
        # Cleanup cached thumbnails
        thumb_file = get_thumbnail_dir("photos") / f"{self.file_id}.jpg"
        if thumb_file.exists():
            try:
                thumb_file.unlink()
            except Exception:
                pass
                
        # Cleanup temp directory
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_generate_photo_thumbnail_for_gif(self):
        dest_thumb = Path(self.temp_dir) / "thumb.jpg"
        success = generate_photo_thumbnail(self.gif_path, dest_thumb)
        self.assertTrue(success)
        self.assertTrue(dest_thumb.exists())
        
        with Image.open(dest_thumb) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertEqual(img.mode, "RGB")
            self.assertLessEqual(img.width, 400)
            self.assertLessEqual(img.height, 400)

    def test_preview_static_default(self):
        # By default animated is False -> should return static cached JPEG
        resp = preview(item_id=self.file_id, animated=False)
        self.assertEqual(resp.media_type, "image/jpeg")
        
        # Verify thumbnail is now cached on disk
        thumb_file = get_thumbnail_dir("photos") / f"{self.file_id}.jpg"
        self.assertTrue(thumb_file.exists())
        
        # Calling again should hit offline cache and return image/jpeg
        resp2 = preview(item_id=self.file_id, animated=False)
        self.assertEqual(resp2.media_type, "image/jpeg")

    def test_preview_animated_true(self):
        # When animated=True -> should return raw GIF file with image/gif
        resp = preview(item_id=self.file_id, animated=True)
        self.assertEqual(resp.media_type, "image/gif")
        self.assertEqual(resp.path, str(self.gif_path))

    def test_open_file_path(self):
        with patch("os.startfile", create=True) as mock_startfile:
            res = open_file_path(str(self.gif_path))
            self.assertTrue(res.get("opened"))
            self.assertEqual(res.get("path"), str(self.gif_path))

if __name__ == "__main__":
    unittest.main()
