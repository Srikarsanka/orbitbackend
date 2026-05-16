# Use standard Python 3.10
FROM python:3.10

# Install ONLY required system dependencies
RUN apt-get update && apt-get install -y \
      libgl1 \
      libglib2.0-0 \
      libjpeg62-turbo \
      libpng-dev \
      build-essential \
      && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces require running as a non-root user
RUN useradd -m -u 1000 user

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements first for better Docker layer caching
COPY --chown=user requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy your Python backend source code
COPY --chown=user . .

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Start FastAPI using uvicorn on port 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
