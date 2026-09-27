#!/usr/bin/env bash
# ==============================================================================
# Container Teardown & Termination Script
# Stops, removes containers, networks, and optionally wipes persistent volumes.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REMOVE_VOLUMES=false
ACTION="down" # down or stop
REMOVE_ORPHANS=true

usage() {
  cat << EOF
Usage: ./scripts/stop.sh [OPTIONS]

Termination Options:
  --stop                  Stop containers without removing them.
  --down, --terminate     Stop and remove all containers and networks (default).
  -v, --volumes           Remove persistent named volumes (e.g., mysql_data). CAUTION: Data will be wiped!
  --clean                 Remove containers, networks, and orphaned resources.
  -h, --help              Show this help message.

Examples:
  # Normal graceful teardown (preserves database data):
  ./scripts/stop.sh

  # Stop containers without removing them:
  ./scripts/stop.sh --stop

  # Full termination including persistent volume removal (fresh wipe):
  ./scripts/stop.sh --volumes
EOF
}

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stop)
      ACTION="stop"
      shift
      ;;
    --down|--terminate)
      ACTION="down"
      shift
      ;;
    -v|--volumes)
      REMOVE_VOLUMES=true
      ACTION="down"
      shift
      ;;
    --clean)
      ACTION="down"
      REMOVE_ORPHANS=true
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

# Support both docker compose and legacy docker-compose
if command -v docker-compose &> /dev/null; then
  COMPOSE="docker-compose --profile phpmyadmin"
else
  COMPOSE="docker compose --profile phpmyadmin"
fi

if [[ "$ACTION" == "stop" ]]; then
  echo -e "${CYAN}==> Stopping running containers...${NC}"
  $COMPOSE stop
  echo -e "${GREEN}==> All containers stopped.${NC}"
elif [[ "$ACTION" == "down" ]]; then
  echo -e "${CYAN}==> Terminating and removing containers...${NC}"
  if [[ "$REMOVE_VOLUMES" == true ]]; then
    echo -e "${YELLOW}Warning: Removing persistent database volumes!${NC}"
    $COMPOSE down -v --remove-orphans
    echo -e "${GREEN}==> All containers and volumes terminated.${NC}"
  else
    $COMPOSE down --remove-orphans
    echo -e "${GREEN}==> All containers and networks removed (persistent volumes preserved).${NC}"
  fi
fi
