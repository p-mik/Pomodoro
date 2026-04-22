FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Placeholder pro build — při runtime přepíše env_file
ENV SECRET_KEY=placeholder-for-collectstatic
RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "pomodoro_project.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
