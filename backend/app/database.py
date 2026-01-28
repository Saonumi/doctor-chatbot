from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# 1. Lấy đường dẫn tuyệt đối tới file .env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")

# 2. Load file .env theo đường dẫn cụ thể
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

# Debug: In ra để kiểm tra xem đã lấy được chưa (Xong thì xóa dòng này đi cũng được)
print(f"DEBUG: DATABASE_URL is loaded: {DATABASE_URL is not None}")
# --------------------

if not DATABASE_URL:
    raise ValueError("Chua tim thay DATABASE_URL trong file .env")

# 3. Tạo kết nối
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()