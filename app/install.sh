#!/usr/bin/env bash

set -o nounset    # error when referencing undefined variable
set -o errexit    # exit when command fails

# goes to the script directory
cd "$(dirname "$0")"

MERMAID_PACKAGE_URL="https://cdn.jsdelivr.net/npm/mermaid/package.json"
MERMAID_TARGET="./_static/mermaid.min.js"
MERMAID_VERSION_FILE="./_static/mermaid.version.json"

BOLD="$(tput bold 2>/dev/null || echo '')"
GREY="$(tput setaf 0 2>/dev/null || echo '')"
BLUE="$(tput setaf 4 2>/dev/null || echo '')"
RED="$(tput setaf 1 2>/dev/null || echo '')"
NO_COLOR="$(tput sgr0 2>/dev/null || echo '')"
YELLOW="$(tput setaf 3 2>/dev/null || echo '')"

error() {
  printf "${RED} $@${NO_COLOR}\n" >&2
}

warn() {
  printf "${YELLOW}! $@${NO_COLOR}\n"
}

info() {
  printf "${BLUE} $@${NO_COLOR}\n"
}

fetch() {
  local command
  if hash curl 2>/dev/null; then
    set +e
    command="curl --fail -L $1"
    curl --compressed --fail -L "$1"
    rc=$?
    set -e
  else
    if hash wget 2>/dev/null; then
      set +e
      command="wget -O- -q $1"
      wget -O- -q "$1"
      rc=$?
      set -e
    else
      error "No HTTP download program (curl, wget) found…"
      return 1
    fi
  fi

  if [ $rc -ne 0 ]; then
    error "Command failed (exit code $rc): ${BLUE}${command}${NO_COLOR}"
    return $rc
  fi
}

get_latest_release() {
  fetch "https://api.github.com/repos/iamcco/markdown-preview.nvim/releases/latest" |
    grep '"tag_name":' |
    sed -E 's/.*"([^"]+)".*/\1/'
}

download_mermaid() {
  info "Fetching latest Mermaid from jsDelivr."
  local package_info
  local version
  local url
  local tmp_file

  if ! package_info="$(fetch "${MERMAID_PACKAGE_URL}")"; then
    warn "Could not fetch Mermaid metadata. Keeping bundled Mermaid."
    return 0
  fi

  version="$(printf '%s' "${package_info}" | grep '"version"' | head -n 1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  if [ -z "${version}" ]; then
    warn "Could not detect Mermaid version from CDN metadata. Keeping bundled Mermaid."
    return 0
  fi

  url="https://cdn.jsdelivr.net/npm/mermaid@${version}/dist/mermaid.min.js"
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/markdown-preview-mermaid.XXXXXX")"

  if fetch "${url}" > "${tmp_file}"; then
    mv "${tmp_file}" "${MERMAID_TARGET}"
    printf '{\n  "version": "%s",\n  "url": "%s"\n}\n' "${version}" "${url}" > "${MERMAID_VERSION_FILE}"
    info "Updated Mermaid to ${version}"
  else
    rm -f "${tmp_file}"
    warn "Could not download Mermaid from ${url}. Keeping bundled Mermaid."
  fi
}

mermaid_only=0
if [ "${1:-}" = "--mermaid-only" ]; then
  mermaid_only=1
  shift
fi

download() {
  mkdir -p bin
  cd bin
  url="https://github.com/iamcco/markdown-preview.nvim/releases/download/$tag/${1}"
  info "Downloading binary from ${url}"
  if fetch "${url}" | tar xzfv -; then
    chmod a+x "${1%.tar.gz}"
    return
  else
    warn "Binary not available for now, please wait for a few minutes."
  fi
}

if [ "${mermaid_only}" -eq 0 ]; then
  if [ $# -eq 0 ]; then
    info "Fetching latest release."
    tag=$(get_latest_release)
  else
    tag=$1
  fi

  arch=$(uname -sm)
  case "${arch}" in
    "Linux x86_64") download markdown-preview-linux.tar.gz ;;
    "Linux i686") download markdown-preview-linux.tar.gz ;;
    "Darwin x86_64") download markdown-preview-macos.tar.gz ;;
    "Darwin arm64") download markdown-preview-macos-arm64.tar.gz ;;
    *) info "No pre-built binary available for ${arch}.";;
  esac

  cd "$(dirname "$0")"
fi

download_mermaid
