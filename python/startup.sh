#!/bin/bash
set -e

echo "🔧 Installing Python packages..."
pip install -r /home/site/wwwroot/requirements.txt --quiet 2>&1 | tail -5

echo "✅ Packages installed. Starting gunicorn..."
exec gunicorn app:app -k uvicorn.workers.UvicornWorker --bind=0.0.0.0:8000 --timeout 600
