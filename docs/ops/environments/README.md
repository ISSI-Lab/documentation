# Deployment Environments

This document details the configuration requirements and topology for each deployment target.

---

## 1. Local Development (`development`)
- **Host**: Local developer workstation (macOS, Linux, Windows WSL2).
- **Tool**: `docker-compose.yml`.
- **Ports**: Frontend `3939`, Backend `8000`.
- **Database**: Ephemeral containerized or SQLite/mock for dev speed.
- **Reload**: Hot module replacement & code live reload enabled via volumes.

---

## 2. Staging (`staging`)
- **Host**: Cloud VM or Kubernetes cluster.
- **Goal**: Production parity for QA and integration testing.
- **Volumes**: Persistent cloud storage for databases; code baked into immutable images.

---

## 3. Production (`production`)
- **Host**: Cloud VM, Container Service (ECS / Cloud Run), or Kubernetes.
- **Security**: Strict TLS/SSL, secrets managed via Vault / AWS Secrets Manager / Cloud KMS.
- **Logging**: Centralized log streaming (Datadog, CloudWatch, Prometheus/Grafana).
