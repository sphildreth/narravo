#!/usr/bin/env bash
# Deploy Narravo from a Git tag or origin/main on a non-Docker host.

set -euo pipefail

: "${APP_ROOT:=/opt/narravo}"
: "${REPO_URL:=https://github.com/sphildreth/narravo.git}"
: "${APP_USER:=narravo}"
: "${SERVICE_NAME:=narravo}"
: "${NODE_ENV:=production}"
: "${PNPM_FLAGS:=--frozen-lockfile}"

MODE=""
TAG_VALUE=""

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") --tag <vX.Y.Z>   Deploy the exact Git tag
  $(basename "$0") --main            Deploy origin/main
  $(basename "$0") --help            Show this help

Environment overrides:
  APP_ROOT       (default: $APP_ROOT)
  REPO_URL       (default: $REPO_URL)
  APP_USER       (default: $APP_USER)
  SERVICE_NAME   (default: $SERVICE_NAME)
  NODE_ENV       (default: $NODE_ENV)
  PNPM_FLAGS     (default: $PNPM_FLAGS)
USAGE
}

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

parse_args() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        MODE="tag"
        TAG_VALUE="${2:-}"
        [[ -n "$TAG_VALUE" ]] || {
          echo "--tag requires a value, for example v1.0.1" >&2
          exit 1
        }
        shift 2
        ;;
      --main)
        MODE="main"
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done

  if [[ "$MODE" != "tag" && "$MODE" != "main" ]]; then
    echo "You must specify either --tag <vX.Y.Z> or --main" >&2
    exit 1
  fi
}

version_ge() {
  local current="${1#v}"
  local required="${2#v}"
  [[ "$(printf '%s\n%s\n' "$required" "$current" | sort -V | head -n1)" == "$required" ]]
}

run_as_app() {
  sudo -u "$APP_USER" -H bash -lc "$1"
}

ensure_repo() {
  if [[ ! -d "$APP_ROOT/.git" ]]; then
    echo "==> Cloning repository into $APP_ROOT"
    sudo mkdir -p "$APP_ROOT"
    sudo chown -R "$APP_USER":"$APP_USER" "$APP_ROOT"
    run_as_app "git clone '$REPO_URL' '$APP_ROOT'"
  fi
}

fetch_refs() {
  echo "==> Fetching tags and pruning remotes"
  run_as_app "cd '$APP_ROOT' && git fetch --tags --prune --force"
}

stash_public_if_tracked() {
  cat <<'SCRIPT'
if git ls-files --error-unmatch public >/dev/null 2>&1; then
  echo 'public/ is tracked; stashing it temporarily'
  git stash push -m 'stash-public' -- public || true
fi
SCRIPT
}

restore_public_stash() {
  cat <<'SCRIPT'
if git stash list | grep -q 'stash-public'; then
  echo 'Restoring stashed public/'
  git checkout -- public || true
  git stash pop || true
fi
SCRIPT
}

checkout_tag() {
  local tag="$1"
  echo "==> Checking out tag: $tag"
  run_as_app "
    set -e
    cd '$APP_ROOT'
    $(stash_public_if_tracked)
    git reset --hard
    git clean -fdx -e public
    git checkout -f --detach '$tag'
    git reset --hard
    $(restore_public_stash)
  "
}

checkout_main() {
  echo "==> Checking out origin/main"
  run_as_app "
    set -e
    cd '$APP_ROOT'
    $(stash_public_if_tracked)
    git fetch origin main --prune
    git checkout -f --detach origin/main
    git reset --hard
    git clean -fdx -e public
    $(restore_public_stash)
  "
}

check_runtime() {
  echo "==> Checking Node.js and package manager runtime"

  local node_version
  node_version="$(node -p 'process.versions.node')"
  if ! version_ge "$node_version" "22.13.0"; then
    cat >&2 <<ERROR
ERROR: Narravo requires Node.js 22.13 or newer.
Current Node.js: $node_version

Install Node.js 22 on this host, then rerun the deploy:
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt -y install nodejs
  sudo corepack enable
ERROR
    exit 1
  fi

  local package_manager
  package_manager="$(run_as_app "cd '$APP_ROOT' && node -p \"require('./package.json').packageManager || 'pnpm@11.5.2'\"")"
  echo "==> Activating $package_manager with Corepack"
  sudo corepack enable pnpm
  sudo corepack prepare "$package_manager" --activate
  run_as_app "cd '$APP_ROOT' && pnpm --version"
}

stop_service() {
  echo "==> Stopping service: $SERVICE_NAME"
  sudo systemctl stop "$SERVICE_NAME"
}

start_service() {
  echo "==> Starting service: $SERVICE_NAME"
  sudo systemctl start "$SERVICE_NAME"
  sudo systemctl --no-pager --full status "$SERVICE_NAME" || true
  echo "==> Recent logs:"
  journalctl -u "$SERVICE_NAME" -n 60 --no-pager --since "10 minutes ago" || true
}

install_deps() {
  echo "==> Installing dependencies with pnpm ($PNPM_FLAGS)"
  run_as_app "cd '$APP_ROOT' && pnpm install $PNPM_FLAGS"
}

run_migrations() {
  echo "==> Running database migrations"
  run_as_app "cd '$APP_ROOT' && NODE_ENV='$NODE_ENV' pnpm -s drizzle:migrate"
}

typecheck_and_build() {
  echo "==> Typechecking"
  run_as_app "cd '$APP_ROOT' && NODE_ENV='$NODE_ENV' pnpm -s typecheck"
  echo "==> Building (NODE_ENV=$NODE_ENV)"
  run_as_app "cd '$APP_ROOT' && NODE_ENV='$NODE_ENV' pnpm -s build"
}

main() {
  parse_args "$@"
  need git
  need node
  need sudo
  need systemctl

  ensure_repo
  fetch_refs

  if [[ "$MODE" == "tag" ]]; then
    if ! run_as_app "cd '$APP_ROOT' && git rev-parse -q --verify 'refs/tags/$TAG_VALUE' >/dev/null"; then
      echo "ERROR: Tag not found: $TAG_VALUE" >&2
      exit 1
    fi
    checkout_tag "$TAG_VALUE"
  else
    checkout_main
  fi

  check_runtime
  stop_service
  install_deps
  run_migrations
  typecheck_and_build
  start_service

  echo "==> Deployment complete."
}

main "$@"
