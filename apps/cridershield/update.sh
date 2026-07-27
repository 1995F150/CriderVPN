#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this updater with sudo." >&2
  exit 1
fi

repo_root="/opt/cridervpn/repository"
[[ -d "${repo_root}/.git" ]] || {
  echo "Managed CriderVPN repository not found at ${repo_root}." >&2
  exit 1
}

git -C "${repo_root}" pull --ff-only
exec bash "${repo_root}/scripts/install-cridershield.sh"
