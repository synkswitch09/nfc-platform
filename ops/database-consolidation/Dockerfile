FROM postgres:18-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-psycopg2 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY ops/database-consolidation/worker.py /migration/worker.py
ENTRYPOINT ["python3", "/migration/worker.py"]
