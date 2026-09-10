# Cross-Platform Developer Setup Guide

This runbook provides step-by-step instructions for setting up your local developer environment across different operating systems.

---

## 1. macOS Setup
1. Install [Homebrew](https://brew.sh/):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install Docker Desktop or OrbStack:
   ```bash
   brew install --cask docker
   ```
3. Clone repository and verify git line ending configuration:
   ```bash
   git clone <repo-url>
   cd documentation
   git config core.autocrlf input
   ```

---

## 2. Linux (Ubuntu / Debian / Fedora)
1. Install Docker Engine and Docker Compose Plugin:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER
   ```
2. Ensure line endings are normalized:
   ```bash
   git config core.autocrlf input
   ```

---

## 3. Windows 10 / 11 (WSL2 Recommended)
1. Enable WSL2 and install Ubuntu:
   ```powershell
   wsl --install
   ```
2. In Docker Desktop Settings, enable **WSL 2 based engine** and enable integration with your Ubuntu distro.
3. Open your Ubuntu WSL shell and clone the repo inside the Linux filesystem (e.g. `~/projects/` — do NOT clone into `/mnt/c/` to ensure high disk I/O performance).
4. Configure Git line endings:
   ```bash
   git config --global core.autocrlf input
   ```
