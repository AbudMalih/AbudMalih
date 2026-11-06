# syntax=docker/dockerfile:1.7
# TURVIO route optimizer (FastAPI + OR-Tools). Internal only – never published to the internet.
# Optional build secret `build_ca`: extra CA for a TLS-inspecting proxy (CI/sandboxes).
# Not needed on the staging server; never stored in an image layer.
ARG PYTHON_IMAGE=python:3.13-slim-trixie@sha256:09a17cad02668ae61ece136b4fd36ac3849e14f670ebedb637ea3e15580525bc
FROM ${PYTHON_IMAGE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY services/optimizer/requirements.txt .
RUN --mount=type=secret,id=build_ca,required=false if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm_config_cafile=/run/secrets/build_ca PIP_CERT=/run/secrets/build_ca; fi && pip install -r requirements.txt && useradd --system --uid 10001 --no-create-home optimizer
COPY services/optimizer/turvio_optimizer ./turvio_optimizer
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=4s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"]
CMD ["uvicorn", "turvio_optimizer.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-server-header"]
