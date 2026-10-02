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
FLAG_SETUP_EMAIL=false

usage() {
  cat << EOF
Usage: ./scripts/start.sh [OPTIONS]

Environment Modes:
  Default                 Runs in DEVELOPMENT mode (phpMyAdmin enabled on port 28080).
  --prod, -prod           Runs in PRODUCTION mode (phpMyAdmin disabled by default).

Email & SMTP Setup:
  -e, --email             Launch interactive wizard to update email server account
                          and credentials (stored encrypted in email_config.json).

Production & Domain Setup:
  -i, --init              First-time setup: prompts for domain (default: ${DEFAULT_DOMAIN}),
                          generates and installs Host Nginx conf in /etc/nginx/sites-available/,
                          creates symlink in /etc/nginx/sites-enabled/, provisions SSL certs,
                          and restarts host Nginx.
  -d, --domain <domain>   Specify domain directly without interactive prompt.
  -pma, --pma             Enable phpMyAdmin container on port 28080 in production (via ./scripts/enable-pma.sh).
  --ssl, --certbot        Force Run Certbot on host for SSL certificate generation.

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

  # Enable/Disable phpMyAdmin in production on demand:
  ./scripts/enable-pma.sh
  ./scripts/enable-pma.sh --stop
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
    -e|--email|--setup-email)
      FLAG_SETUP_EMAIL=true
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

# Launch email configuration setup if requested
if [[ "$FLAG_SETUP_EMAIL" == true ]]; then
  if command -v python3 &> /dev/null && [[ -f "${PROJECT_ROOT}/scripts/manage_email_config.py" ]]; then
    python3 "${PROJECT_ROOT}/scripts/manage_email_config.py" setup
  fi
fi

# Determine active environment
if [[ "$IS_PROD" == true ]]; then
  CURRENT_ENV="production"
else
  CURRENT_ENV="${NODE_ENV:-development}"
fi

# Ensure email configuration is encrypted and report status
if command -v python3 &> /dev/null && [[ -f "${PROJECT_ROOT}/scripts/manage_email_config.py" ]]; then
  echo -e "${CYAN}==> Verifying encrypted email configuration...${NC}"
  python3 "${PROJECT_ROOT}/scripts/manage_email_config.py" ensure-encrypted
  python3 "${PROJECT_ROOT}/scripts/manage_email_config.py" status
fi

export EMAIL_CONFIG_SECRET="${EMAIL_CONFIG_SECRET:-docforge-email-secret-key-2026}"

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

# 2. First-time Host Nginx configuration setup & SSL provisioning
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

  # Host Nginx paths
  NGINX_AVAILABLE_DIR="/etc/nginx/sites-available"
  NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
  LETSENCRYPT_DIR="/etc/letsencrypt/live/${TARGET_DOMAIN}"
  SSL_CERT_FILE="${LETSENCRYPT_DIR}/fullchain.pem"

  # Sudo prefix helper
  SUDO=""
  if [[ "$EUID" -ne 0 ]]; then
    if command -v sudo &> /dev/null; then
      SUDO="sudo"
    fi
  fi

  # Helper functions for Nginx reload and restart
  reload_host_nginx() {
    if $SUDO nginx -t 2>/dev/null; then
      if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
        $SUDO systemctl reload nginx
      elif command -v service &> /dev/null; then
        $SUDO service nginx reload
      else
        $SUDO nginx -s reload 2>/dev/null || true
      fi
      return 0
    else
      return 1
    fi
  }

  restart_host_nginx() {
    echo -e "${CYAN}==> Validating Nginx syntax and restarting Host Nginx...${NC}"
    if $SUDO nginx -t; then
      if command -v systemctl &> /dev/null; then
        $SUDO systemctl restart nginx
        echo -e "${GREEN}✓ Host Nginx successfully restarted (systemctl restart nginx).${NC}"
      elif command -v service &> /dev/null; then
        $SUDO service nginx restart
        echo -e "${GREEN}✓ Host Nginx successfully restarted (service nginx restart).${NC}"
      else
        $SUDO nginx -s reload 2>/dev/null || true
        echo -e "${GREEN}✓ Host Nginx successfully reloaded.${NC}"
      fi
      return 0
    else
      echo -e "${RED}⚠️  Nginx syntax test failed! Please check configuration.${NC}"
      return 1
    fi
  }

  echo -e "${CYAN}==> Installing Host Nginx site configuration...${NC}"

  # Attempt automated copy and symlink if /etc/nginx exists or sudo is present
  if [[ -d "/etc/nginx" ]] || [[ -n "$SUDO" ]]; then
    $SUDO mkdir -p "$NGINX_AVAILABLE_DIR" "$NGINX_ENABLED_DIR" "${CERTBOT_WEBROOT}" 2>/dev/null || true

    if [[ -d "$NGINX_AVAILABLE_DIR" && -d "$NGINX_ENABLED_DIR" ]]; then
      # Check if SSL certificate already exists
      if [[ -f "$SSL_CERT_FILE" && "$FLAG_SSL" != true ]]; then
        echo -e "${GREEN}✓ Existing SSL certificate found at:${NC} ${SSL_CERT_FILE}"
        echo -e "${CYAN}   ↳ Copying production SSL configuration to ${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf...${NC}"
        $SUDO cp "$TARGET_CONF" "${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf"
        $SUDO ln -sf "${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf" "${NGINX_ENABLED_DIR}/${TARGET_DOMAIN}.conf"
        echo -e "${GREEN}✓ Symlink created: ${NGINX_ENABLED_DIR}/${TARGET_DOMAIN}.conf -> ${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf${NC}"
        
        # Test syntax and restart host Nginx
        restart_host_nginx || true
      else
        if [[ -f "$SSL_CERT_FILE" ]]; then
          echo -e "${GREEN}✓ Existing SSL certificate found at:${NC} ${SSL_CERT_FILE}"
        else
          echo -e "${YELLOW}No existing SSL certificate found at:${NC} ${SSL_CERT_FILE}"
        fi

        echo -e "${CYAN}   ↳ Step 1: Installing bootstrap HTTP configuration for ACME challenge...${NC}"
        $SUDO cp "$BOOTSTRAP_CONF" "${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf"
        $SUDO ln -sf "${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf" "${NGINX_ENABLED_DIR}/${TARGET_DOMAIN}.conf"
        echo -e "${GREEN}✓ Bootstrap configuration installed and symlinked.${NC}"

        # Reload Nginx to serve ACME challenge path
        echo -e "${CYAN}   ↳ Reloading Nginx to activate ACME challenge path...${NC}"
        reload_host_nginx || true

        # Run Certbot to request SSL certificate
        echo -e "${CYAN}   ↳ Step 2: Requesting SSL certificate from Let's Encrypt...${NC}"
        if command -v certbot &> /dev/null; then
          if $SUDO certbot certonly --webroot -w "${CERTBOT_WEBROOT}" -d "${TARGET_DOMAIN}"; then
            echo -e "${GREEN}✓ SSL certificate successfully obtained!${NC}"
            echo -e "${CYAN}   ↳ Step 3: Installing production SSL configuration...${NC}"
            $SUDO cp "$TARGET_CONF" "${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf"
            # Final restart of Host Nginx
            restart_host_nginx || true
          else
            echo -e "${RED}⚠️  Certbot certificate acquisition failed.${NC}"
            echo -e "${YELLOW}   Bootstrap HTTP configuration is currently active on port 80.${NC}"
            echo -e "${BLUE}   Once DNS is resolved, run manually to complete SSL activation:${NC}"
            echo "     sudo certbot certonly --webroot -w ${CERTBOT_WEBROOT} -d ${TARGET_DOMAIN}"
            echo "     sudo cp ${TARGET_CONF} ${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf"
            echo "     sudo nginx -t && sudo systemctl restart nginx"
          fi
        else
          echo -e "${YELLOW}Certbot is not installed on this host.${NC}"
          echo -e "${BLUE}To obtain certificate and activate SSL:${NC}"
          echo "  1. sudo certbot certonly --webroot -w ${CERTBOT_WEBROOT} -d ${TARGET_DOMAIN}"
          echo "  2. sudo cp ${TARGET_CONF} ${NGINX_AVAILABLE_DIR}/${TARGET_DOMAIN}.conf"
          echo "  3. sudo nginx -t && sudo systemctl restart nginx"
        fi
      fi
    else
      echo -e "${YELLOW}Host Nginx directories (${NGINX_AVAILABLE_DIR}) not accessible or writable.${NC}"
      echo -e "${BLUE}To install manually on host Nginx:${NC}"
      echo "  sudo cp docs/ops/nginx/generated/${TARGET_DOMAIN}.conf /etc/nginx/sites-available/${TARGET_DOMAIN}.conf"
      echo "  sudo ln -sf /etc/nginx/sites-available/${TARGET_DOMAIN}.conf /etc/nginx/sites-enabled/"
      echo "  sudo nginx -t && sudo systemctl restart nginx"
    fi
  else
    echo -e "${YELLOW}Host Nginx not detected on this machine.${NC}"
    echo -e "${BLUE}Configuration files generated under docs/ops/nginx/generated/${NC}"
  fi
  echo ""
fi


# 3. Determine Compose Runner & Profiles
COMPOSE_PROFILES=""
if [[ "$CURRENT_ENV" != "production" ]]; then
  if [[ "$IS_PMA" == true ]]; then
    COMPOSE_PROFILES="--profile phpmyadmin"
    echo -e "${GREEN}[phpMyAdmin] Enabled on port ${PMA_PORT} (Env: ${CURRENT_ENV})${NC}"
  else
    echo -e "${BLUE}[phpMyAdmin] Disabled (Env: ${CURRENT_ENV})${NC}"
  fi
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

if [[ "$CURRENT_ENV" == "production" ]]; then
  echo -e "${CYAN}==> Starting container services in background (${CURRENT_ENV})...${NC}"
  NODE_ENV="${CURRENT_ENV}" $DOCKER_COMPOSE up -d --build

  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}✓ Application running successfully! (${CURRENT_ENV})           ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo -e "  • Frontend Container: http://localhost:${FRONTEND_PORT}"
  echo -e "  • MySQL Database:     localhost:${MYSQL_PORT}"
  if [[ "$IS_PMA" == true ]]; then
    echo ""
    "${SCRIPT_DIR}/enable-pma.sh" --start
  else
    echo -e "  • phpMyAdmin:         Disabled (Run ./scripts/enable-pma.sh to enable)"
  fi
  echo ""
  $DOCKER_COMPOSE ps
else
  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}  Starting Development Stack (Attached / Live Logs)             ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo -e "  • Frontend UI:    http://localhost:${FRONTEND_PORT}"
  echo -e "  • Backend API:    http://localhost:${BACKEND_PORT}"
  echo -e "  • MySQL Database: localhost:${MYSQL_PORT}"
  if [[ "$IS_PMA" == true ]]; then
    echo -e "  • phpMyAdmin:     http://localhost:${PMA_PORT}"
  fi
  echo -e "${YELLOW}  Press Ctrl+C to stop services.${NC}"
  echo -e "${CYAN}----------------------------------------------------------------${NC}"
  echo ""
  NODE_ENV="${CURRENT_ENV}" $DOCKER_COMPOSE up --build
fi
