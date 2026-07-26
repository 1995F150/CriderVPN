#!/usr/bin/env bash
set -Eeuo pipefail

config_file="${CRIDERVPN_UPDATE_CONFIG:-/etc/cridervpn/update.env}"
lock_file="/run/lock/cridervpn-update.lock"
state_dir="/var/lib/cridervpn/update"
state_file="${state_dir}/status.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "The updater must run as root." >&2
  exit 1
fi

if [[ ! -r "${config_file}" ]]; then
  echo "Update configuration not readable: ${config_file}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${config_file}"

: "${REPOSITORY_URL:?REPOSITORY_URL is required}"
: "${REPOSITORY_DIR:?REPOSITORY_DIR is required}"
: "${UPDATE_BRANCH:=main}"
: "${UPDATE_MODE:=apply}"

case "${UPDATE_MODE}" in
  check|apply) ;;
  *) echo "UPDATE_MODE must be check or apply." >&2; exit 1 ;;
esac

install -d -m 0750 "${state_dir}"
exec 9>"${lock_file}"
flock -n 9 || {
  echo "Another update check is already running."
  exit 0
}

if [[ ! -d "${REPOSITORY_DIR}/.git" ]]; then
  install -d -m 0755 "$(dirname -- "${REPOSITORY_DIR}")"
  git clone --branch "${UPDATE_BRANCH}" --single-branch -- "${REPOSITORY_URL}" "${REPOSITORY_DIR}"
fi

actual_remote="$(git -C "${REPOSITORY_DIR}" remote get-url origin)"
if [[ "${actual_remote}" != "${REPOSITORY_URL}" ]]; then
  echo "Refusing update: unexpected origin URL: ${actual_remote}" >&2
  exit 1
fi

current_commit="$(git -C "${REPOSITORY_DIR}" rev-parse HEAD)"
git -C "${REPOSITORY_DIR}" fetch --quiet --prune origin "${UPDATE_BRANCH}"
available_commit="$(git -C "${REPOSITORY_DIR}" rev-parse "origin/${UPDATE_BRANCH}")"
update_available=false
update_applied=false

if [[ "${current_commit}" != "${available_commit}" ]]; then
  update_available=true

  if ! git -C "${REPOSITORY_DIR}" merge-base --is-ancestor "${current_commit}" "${available_commit}"; then
    echo "Refusing non-fast-forward update." >&2
    exit 1
  fi

  if [[ "${UPDATE_MODE}" == "apply" ]]; then
    git -C "${REPOSITORY_DIR}" checkout --quiet "${UPDATE_BRANCH}"
    git -C "${REPOSITORY_DIR}" merge --quiet --ff-only "origin/${UPDATE_BRANCH}"
    current_commit="$(git -C "${REPOSITORY_DIR}" rev-parse HEAD)"
    update_applied=true

    # Refresh only updater-owned runtime files. Network activation remains manual.
    install -m 0755 "${REPOSITORY_DIR}/scripts/check-for-updates.sh" /opt/cridervpn/scripts/check-for-updates.sh
    install -m 0644 "${REPOSITORY_DIR}/systemd/cridervpn-update.service" /etc/systemd/system/cridervpn-update.service
    install -m 0644 "${REPOSITORY_DIR}/systemd/cridervpn-update.timer" /etc/systemd/system/cridervpn-update.timer
    systemctl daemon-reload
  fi
fi

checked_at="$(date -u --iso-8601=seconds)"
tmp_file="$(mktemp "${state_dir}/status.env.XXXXXX")"
{
  printf 'CHECKED_AT=%q\n' "${checked_at}"
  printf 'CURRENT_COMMIT=%q\n' "${current_commit}"
  printf 'AVAILABLE_COMMIT=%q\n' "${available_commit}"
  printf 'UPDATE_AVAILABLE=%q\n' "${update_available}"
  printf 'UPDATE_APPLIED=%q\n' "${update_applied}"
  printf 'UPDATE_MODE=%q\n' "${UPDATE_MODE}"
} > "${tmp_file}"
chmod 0640 "${tmp_file}"
mv -f "${tmp_file}" "${state_file}"

if [[ "${update_applied}" == "true" ]]; then
  echo "CriderVPN updated to ${current_commit}."
elif [[ "${update_available}" == "true" ]]; then
  echo "CriderVPN update available: ${available_commit}."
else
  echo "CriderVPN is current at ${current_commit}."
fi
