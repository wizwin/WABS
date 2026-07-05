import re

STANDARD_CATEGORIES = [
    'photo', 'video', 'audio', 'document', 'ebook', 'code', 
    'font', 'database', 'compressed', 'installer', 'binary'
]

SEARCH_PREFIXES = [
    "date:", "tag:", "type:", "name:", "size:", "length:", "object:", "person:",
    "camera:", "resolution:", "fps:", "artist:", "album:", "genre:", "meta:"
]

SEARCHABLE_DOCUMENT_CATEGORIES = ['document', 'ebook', 'code']

# Extensions mapped to their respective category
CATEGORY_EXTENSIONS = {
    "photo": {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".raw", ".svg", ".ico", ".xcf", ".dng"},
    "video": {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"},
    "audio": {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".alac"},
    "document": {".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".md", ".log"},
    "ebook": {".epub", ".mobi", ".azw3", ".cbz", ".cbr", ".chm"},
    "code": {
        ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".xml", ".yaml", ".yml",
        ".c", ".cpp", ".h", ".java", ".cs", ".go", ".rs", ".rb", ".php", ".sh", ".bat", ".ps1", ".sql", ".ini"
    },
    "font": {".ttf", ".otf", ".woff", ".woff2", ".eot"},
    "database": {".db", ".sqlite", ".sqlite3", ".mdb", ".accdb"},
    "compressed": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"},
    "installer": {".exe", ".msi", ".apk", ".dmg", ".deb", ".rpm", ".appimage"},
    "binary": {".bin", ".dat", ".iso", ".img", ".vmdk", ".vdi", ".qcow2", ".mpb"},
}

CODE_EXTENSIONS = CATEGORY_EXTENSIONS["code"]
PLAIN_TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".log", ".htm"} | CODE_EXTENSIONS

CRYPT_EXT_PATTERN = re.compile(r"^\.crypt\d{2,}$")
