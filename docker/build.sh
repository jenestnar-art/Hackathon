#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

docker build -t codecrossroad/attacker:latest -f attacker.Dockerfile .
docker build -t codecrossroad/target:latest -f target.Dockerfile .
