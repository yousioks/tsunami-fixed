import os

class Settings():
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", 6379))
    session_ttl: int = 60 * 60 * 4

settings = Settings()