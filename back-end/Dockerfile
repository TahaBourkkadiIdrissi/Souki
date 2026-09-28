FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SOUKI_LOAD_ENV_FILES=0
# Prefer the pinned Python tzdata package over potentially stale OS timezone data.
# Applies equally to the API and the scheduler, which share this image.
ENV PYTHONTZPATH=""
WORKDIR /app
COPY back-end/requirements.lock.txt ./requirements.lock.txt
RUN pip install --no-cache-dir -r requirements.lock.txt && useradd --create-home app
COPY --chown=app:app back-end/ ./
RUN python -m unittest tests.test_morocco_timezone
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers"]
