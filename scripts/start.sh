#!/usr/bin/env bash
# ==============================================================================
# Application Startup & Management Script
# Default: Development mode (with phpMyAdmin enabled)
# Production: Use --prod flag
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
ENV_DEV_TEMPLATE="${PROJECT_ROOT}/docs/ops/config-templates/.env.dev"
ENV_PROD_TEMPLATE="${PROJECT_ROOT}/docs/ops/config-templates/.env.prod"
NGINX_TEMPLATE="${PROJECT_ROOT}/docs/ops/nginx/host-nginx.conf.template"
NGINX_BOOTSTRAP_TEMPLATE="${PROJECT_ROOT}/docs/ops/nginx/host-nginx-bootstrap.conf.template"
DEFAULT_DOMAIN="doc-forge.appunity.net"

# Flags
IS_PROD=false
INIT_SETUP=false
FLAG_DOMAIN=""
FLAG_PMA=""
FLAG_BUILD_ONLY=false
FLAG_NO_CACHE=false
FLAG_SSL=false

usage() {
  cat << EOF
Usage: ./scripts/start.sh [OPTIONS]

Environment Modes:
  Default                 Runs in DEVELOPMENT mode (phpMyAdmin enabled on port 28080).
  --prod, -prod           Runs in PRODUCTION mode (phpMyAdmin disabled by default).

Production & Domain Setup:
  -i, --init              First-time setup: prompts for domain (default: ${DEFAULT_DOMAIN}),
                          and generates Host Nginx configuration for SSL/reverse-proxy.
  -d, --domain <domain>   Specify domain directly without interactive prompt.
  -pma, --pma             Enable phpMyAdmin container on port 28080 (in production).
  --ssl, --certbot        Run Certbot on host for SSL certificate generation.

Build & Image Options:
  -b, --build             Rebuild container images.
  --no-cache              Build container images without Docker cache.
  -h, --help              Show this help message.

Examples:
  # Standard Development Start (builds and runs with phpMyAdmin):
  ./scripts/start.sh

  # Production Start (secure default, phpMyAdmin disabled):
  ./scripts/start.sh --prod

  # First-time Production Setup & Deployment:
  ./scripts/start.sh --prod --init

  # Production Start with phpMyAdmin explicitly enabled:
  ./scripts/start.sh --prod -pma
EOF
}

# Parse Arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod|-prod)
      IS_PROD=true
      shift
      ;;
    -i|--init|--setup-nginx)
      INIT_SETUP=true
      shift
      ;;
    -d|--domain)
      FLAG_DOMAIN="$2"
      shift 2
      ;;
    -pma|--pma|--enable-pma|-enable-pma)
      FLAG_PMA="true"
      shift
      ;;
    --no-pma|-no-pma|--disable-pma)
      FLAG_PMA="false"
      shift
      ;;
    --ssl|--certbot)
      FLAG_SSL=true
      shift
      ;;
    -b|--build)
      FLAG_BUILD_ONLY=true
      shift
      ;;
    --no-cache)
      FLAG_NO_CACHE=true
      FLAG_BUILD_ONLY=true
      shift
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

# 1. Ensure .env exists
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ "$IS_PROD" == true ]]; then
    SELECTED_TEMPLATE="$ENV_PROD_TEMPLATE"
  else
    SELECTED_TEMPLATE="$ENV_DEV_TEMPLATE"
  fi

  if [[ -f "$SELECTED_TEMPLATE" ]]; then
    echo -e "${CYAN}==> Creating .env from ${SELECTED_TEMPLATE}...${NC}"
    cp "$SELECTED_TEMPLATE" "$ENV_FILE"
  else
    echo -e "${RED}Error: Template ${SELECTED_TEMPLATE} not found!${NC}"
    exit 1
  fi
fi

# Load environment configuration
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Determine active environment
if [[ "$IS_PROD" == true ]]; then
  CURRENT_ENV="production"
else
  CURRENT_ENV="${NODE_ENV:-development}"
fi

# Determine whether phpMyAdmin is enabled:
# Development (default): ENABLED
# Production (--prod):   DISABLED by default unless -pma / --pma is supplied
if [[ "$CURRENT_ENV" == "production" ]]; then
  if [[ "$FLAG_PMA" == "true" ]]; then
    IS_PMA=true
  else
    IS_PMA=false
  fi
else
  # Dev mode default
  if [[ "$FLAG_PMA" == "false" ]]; then
    IS_PMA=false
  else
    IS_PMA=true
  fi
fi

# Port Conflict Detection and Auto-Resolution Helper
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

check_and_resolve_port() {
  local var_name="$1"
  local current_port="$2"
  local service_name="$3"

  local free_port
  free_port=$(find_free_port "$current_port")

  if [[ "$free_port" -ne "$current_port" ]]; then
    echo -e "${YELLOW}⚠️  [Port Conflict] Port ${current_port} for ${service_name} is already in use on this machine.${NC}"
    echo -e "${GREEN}   ↳ Dynamically re-allocated to available port: ${free_port}${NC}"
    export "${var_name}=${free_port}"
    if grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
      sed -i.bak "s|^${var_name}=.*|${var_name}=${free_port}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    fi
  else
    export "${var_name}=${current_port}"
  fi
}

echo -e "${CYAN}==> Validating host port availability...${NC}"
check_and_resolve_port "FRONTEND_PORT" "${FRONTEND_PORT:-3939}" "Frontend UI (Nginx)"
check_and_resolve_port "BACKEND_PORT" "${BACKEND_PORT:-5000}" "Backend Debug Port"
check_and_resolve_port "MYSQL_PORT" "${MYSQL_PORT:-13306}" "MySQL Service"
if [[ "$IS_PMA" == true ]]; then
  check_and_resolve_port "PMA_PORT" "${PMA_PORT:-28080}" "phpMyAdmin"
fi

CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"

# 2. First-time Host Nginx configuration setup
if [[ "$INIT_SETUP" == true || -n "$FLAG_DOMAIN" ]]; then
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}               Host Nginx & Domain Configuration                ${NC}"
  echo -e "${CYAN}================================================================${NC}"

  if [[ -n "$FLAG_DOMAIN" ]]; then
    TARGET_DOMAIN="$FLAG_DOMAIN"
  elif [[ -t 0 ]]; then
    read -r -p "Enter production domain [${DEFAULT_DOMAIN}]: " INPUT_DOMAIN
    TARGET_DOMAIN="${INPUT_DOMAIN:-$DEFAULT_DOMAIN}"
  else
    TARGET_DOMAIN="$DEFAULT_DOMAIN"
  fi

  echo -e "${GREEN}Configuring for domain:${NC} ${TARGET_DOMAIN}"
  
  mkdir -p "${PROJECT_ROOT}/docs/ops/nginx/generated"
  TARGET_CONF="${PROJECT_ROOT}/docs/ops/nginx/generated/${TARGET_DOMAIN}.conf"
  BOOTSTRAP_CONF="${PROJECT_ROOT}/docs/ops/nginx/generated/${TARGET_DOMAIN}-bootstrap.conf"

  # Render templates
  sed -e "s|\${APP_DOMAIN}|${TARGET_DOMAIN}|g" \
      -e "s|\${FRONTEND_PORT}|${FRONTEND_PORT}|g" \
      -e "s|\${PMA_PORT}|${PMA_PORT}|g" \
      -e "s|\${CERTBOT_WEBROOT}|${CERTBOT_WEBROOT}|g" \
      "$NGINX_TEMPLATE" > "$TARGET_CONF"

  if [[ -f "$NGINX_BOOTSTRAP_TEMPLATE" ]]; then
    sed -e "s|\${APP_DOMAIN}|${TARGET_DOMAIN}|g" \
        -e "s|\${FRONTEND_PORT}|${FRONTEND_PORT}|g" \
        -e "s|\${CERTBOT_WEBROOT}|${CERTBOT_WEBROOT}|g" \
        "$NGINX_BOOTSTRAP_TEMPLATE" > "$BOOTSTRAP_CONF"
  fi

  echo -e "${GREEN}✓ Host Nginx SSL config generated at:${NC} docs/ops/nginx/generated/${TARGET_DOMAIN}.conf"
  echo ""
  echo -e "${BLUE}To install on production host Nginx:${NC}"
  echo "  sudo cp docs/ops/nginx/generated/${TARGET_DOMAIN}.conf /etc/nginx/sites-available/${TARGET_DOMAIN}.conf"
  echo "  sudo ln -sf /etc/nginx/sites-available/${TARGET_DOMAIN}.conf /etc/nginx/sites-enabled/"
  echo "  sudo nginx -t && sudo systemctl reload nginx"
  echo ""

  if [[ "$FLAG_SSL" == true ]]; then
    echo -e "${CYAN}==> Requesting Certbot SSL certificate...${NC}"
    if command -v certbot &> /dev/null; then
      sudo mkdir -p "${CERTBOT_WEBROOT}"
      sudo certbot certonly --webroot -w "${CERTBOT_WEBROOT}" -d "${TARGET_DOMAIN}"
    else
      echo -e "${YELLOW}Certbot not found on host. Run manually:${NC}"
      echo "  sudo certbot certonly --webroot -w ${CERTBOT_WEBROOT} -d ${TARGET_DOMAIN}"
    fi
  fi
fi

# 3. Determine Compose Runner & Profiles
COMPOSE_PROFILES=""
if [[ "$IS_PMA" == true ]]; then
  COMPOSE_PROFILES="--profile phpmyadmin"
  echo -e "${GREEN}[phpMyAdmin] Enabled on port ${PMA_PORT} (Env: ${CURRENT_ENV})${NC}"
else
  echo -e "${BLUE}[phpMyAdmin] Disabled (Env: ${CURRENT_ENV})${NC}"
fi

if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose ${COMPOSE_PROFILES}"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose ${COMPOSE_PROFILES}"
else
  echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' was found!${NC}"
  exit 1
fi

# 4. Execute Build / Start
if [[ "$FLAG_BUILD_ONLY" == true ]]; then
  echo -e "${CYAN}==> Building container images...${NC}"
  if [[ "$FLAG_NO_CACHE" == true ]]; then
    $DOCKER_COMPOSE build --no-cache
  else
    $DOCKER_COMPOSE build
  fi
  echo -e "${GREEN}✓ Build completed!${NC}"
fi

echo -e "${CYAN}==> Starting container services (${CURRENT_ENV})...${NC}"
NODE_ENV="${CURRENT_ENV}" $DOCKER_COMPOSE up -d --build

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}✓ Application running successfully! (${CURRENT_ENV})           ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "  • Frontend Container: http://localhost:${FRONTEND_PORT}"
echo -e "  • MySQL Database:     localhost:${MYSQL_PORT}"
if [[ "$IS_PMA" == true ]]; then
  echo -e "  • phpMyAdmin:         http://localhost:${PMA_PORT}"
fi
echo ""
$DOCKER_COMPOSE ps
