#!/usr/bin/env bash
# ==============================================================================
# phpMyAdmin Management Script for Production
# Enables, starts, stops, or checks the status of phpMyAdmin on demand.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ENV_FILE="${PROJECT_ROOT}/.env"
ENV_PROD_TEMPLATE="${PROJECT_ROOT}/docs/ops/config-templates/.env.prod"
ENV_DEV_TEMPLATE="${PROJECT_ROOT}/docs/ops/config-templates/.env.dev"

ACTION="start" # start, stop, status
CUSTOM_PORT=""

usage() {
  cat << EOF
Usage: ./scripts/enable-pma.sh [OPTIONS]

Manage phpMyAdmin container on demand for production environments.

Actions:
  --start, --enable       Start and enable phpMyAdmin in detached mode (default).
  --stop, --disable       Stop and remove the running phpMyAdmin container.
  --status                Check current status of phpMyAdmin container.

Options:
  -p, --port <port>       Override host port for phpMyAdmin (default: \${PMA_PORT:-28080}).
  -h, --help              Show this help message.

Examples:
  # Enable phpMyAdmin in production:
  ./scripts/enable-pma.sh

  # Enable phpMyAdmin with custom port 28085:
  ./scripts/enable-pma.sh --port 28085

  # Check status:
  ./scripts/enable-pma.sh --status

  # Stop and disable phpMyAdmin:
  ./scripts/enable-pma.sh --stop
EOF
}

# Parse Arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start|--enable)
      ACTION="start"
      shift
      ;;
    --stop|--disable)
      ACTION="stop"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    -p|--port)
      CUSTOM_PORT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      usage
      exit 1
      ;;
  esac
done

cd "${PROJECT_ROOT}"

# 1. Ensure .env exists or load defaults
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_PROD_TEMPLATE" ]]; then
    echo -e "${CYAN}==> Creating .env from ${ENV_PROD_TEMPLATE}...${NC}"
    cp "$ENV_PROD_TEMPLATE" "$ENV_FILE"
  elif [[ -f "$ENV_DEV_TEMPLATE" ]]; then
    echo -e "${CYAN}==> Creating .env from ${ENV_DEV_TEMPLATE}...${NC}"
    cp "$ENV_DEV_TEMPLATE" "$ENV_FILE"
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Detect Docker Compose runner
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose --profile phpmyadmin"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose --profile phpmyadmin"
else
  echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' was found!${NC}"
  exit 1
fi

# Determine Port
if [[ -n "$CUSTOM_PORT" ]]; then
  PMA_PORT="$CUSTOM_PORT"
else
  PMA_PORT="${PMA_PORT:-28080}"
fi

# Port Conflict Detection Helper
find_free_port() {
  local req_port="$1"
  local free_port="$req_port"
  if command -v python3 &> /dev/null; then
    free_port=$(python3 -c "
import socket
def can_bind(p):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('0.0.0.0', p))
            return True
    except OSError:
        return False
p = int('$req_port')
while not can_bind(p):
    p += 1
print(p)
")
  fi
  echo "$free_port"
}

# Perform Action
if [[ "$ACTION" == "status" ]]; then
  echo -e "${CYAN}==> Checking phpMyAdmin service status...${NC}"
  if $DOCKER_COMPOSE ps --filter "name=phpmyadmin" | grep -q "phpmyadmin"; then
    echo -e "${GREEN}✓ phpMyAdmin container is running.${NC}"
    $DOCKER_COMPOSE ps phpmyadmin
    echo -e "  • URL: http://localhost:${PMA_PORT}"
  else
    echo -e "${YELLOW}phpMyAdmin container is currently not running.${NC}"
    echo -e "${BLUE}Run './scripts/enable-pma.sh' to start it.${NC}"
  fi
  exit 0
fi

if [[ "$ACTION" == "stop" ]]; then
  echo -e "${CYAN}==> Stopping and disabling phpMyAdmin container...${NC}"
  $DOCKER_COMPOSE stop phpmyadmin 2>/dev/null || true
  $DOCKER_COMPOSE rm -f phpmyadmin 2>/dev/null || true
  echo -e "${GREEN}✓ phpMyAdmin service has been stopped and disabled.${NC}"
  exit 0
fi

if [[ "$ACTION" == "start" ]]; then
  # Check and resolve port conflict if not already bound by phpmyadmin itself
  CURRENT_CONTAINER_RUNNING=false
  if $DOCKER_COMPOSE ps --filter "name=phpmyadmin" 2>/dev/null | grep -q "phpmyadmin"; then
    CURRENT_CONTAINER_RUNNING=true
  fi

  if [[ "$CURRENT_CONTAINER_RUNNING" == false ]]; then
    FREE_PORT=$(find_free_port "$PMA_PORT")
    if [[ "$FREE_PORT" -ne "$PMA_PORT" ]]; then
      echo -e "${YELLOW}⚠️  [Port Conflict] Port ${PMA_PORT} is in use on this host.${NC}"
      echo -e "${GREEN}   ↳ Dynamically re-allocated to available port: ${FREE_PORT}${NC}"
      PMA_PORT="$FREE_PORT"
    fi
  fi

  export PMA_PORT="${PMA_PORT}"

  echo -e "${CYAN}==> Enabling phpMyAdmin for Production on port ${PMA_PORT}...${NC}"

  # Check if MySQL container exists and is running
  if ! docker ps --filter "name=db_mysql" --format "{{.Names}}" | grep -q "db_mysql"; then
    echo -e "${YELLOW}⚠️  MySQL database container (db_mysql) is not currently running.${NC}"
    echo -e "${CYAN}==> Starting database dependencies...${NC}"
    $DOCKER_COMPOSE up -d mysql
  fi

  # Start phpmyadmin container in detached mode
  $DOCKER_COMPOSE up -d phpmyadmin

  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}✓ phpMyAdmin is now ENABLED and running!                        ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo -e "  • Direct Access:      http://localhost:${PMA_PORT}"
  if [[ -n "${APP_DOMAIN}" ]]; then
    echo -e "  • Host Reverse Proxy: https://${APP_DOMAIN}/phpmyadmin/ (if configured in Nginx)"
  fi
  echo -e "  • MySQL Host:         mysql (Port 3306)"
  echo -e "  • Database:           ${MYSQL_DATABASE:-docforge}"
  echo -e "  • User:               ${MYSQL_USER:-docuser}"
  echo ""
  echo -e "${BLUE}To disable phpMyAdmin at any time, run:${NC}"
  echo -e "  ./scripts/enable-pma.sh --stop"
  echo ""
fi
