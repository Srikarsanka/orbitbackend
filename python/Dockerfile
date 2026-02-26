# Use standard Python 3.10 (Not slim, ensuring all standard build tools are present)
FROM python:3.10

# Install ONLY required system dependencies for OpenCV, Pillow, and InsightFace
# Note: libgl1 replaces the deprecated libgl1-mesa-glx on modern Debian
RUN apt-get update && apt-get install -y \
      libgl1 \
      libglib2.0-0 \
      libjpeg62-turbo \
      libpng-dev \
      build-essential \
      && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy your Python backend source code
COPY . .

# Expose port 8000 for Azure App Service Containers
EXPOSE 8000

# Start FastAPI using uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
