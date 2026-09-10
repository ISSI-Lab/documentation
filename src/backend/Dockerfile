# ==============================================================================
# Backend Service Container (Python / FastAPI / Flask / Express)
# ==============================================================================

FROM python:3.11-slim AS base

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies first for layer caching
COPY src/backend/requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy backend source
COPY src/backend/ .

EXPOSE 8000

# Default command for development (overridden if main.py / app.py present)
CMD ["sh", "-c", "if [ -f main.py ]; then python main.py; elif [ -f app/main.py ]; then python app/main.py; else echo 'Backend service listening on port 8000' && nc -lk -p 8000; fi"]
