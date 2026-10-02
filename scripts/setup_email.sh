#!/usr/bin/env bash
# ==============================================================================
# DocForge Interactive Email Setup Tool
# Launches the interactive wizard to configure & encrypt email_config.json
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if command -v python3 &> /dev/null; then
  python3 "${SCRIPT_DIR}/manage_email_config.py" setup "$@"
else
  echo "Error: python3 is required to run manage_email_config.py"
  exit 1
fi
