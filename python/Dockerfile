# Use Python 3.12
FROM python:3.12-slim

# Install system dependencies needed for Pillow, InsightFace, OpenCV
RUN apt-get update && apt-get install -y \
      libgl1-mesa-glx \
      libglib2.0-0 \
      libjpeg62-turbo \
      libpng16-16 \
      ffmpeg \
      && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy your Python backend
COPY . .

EXPOSE 8080

# Start FastAPI using uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
