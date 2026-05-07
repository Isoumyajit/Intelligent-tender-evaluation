#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="ite-postgres"
IMAGE_NAME="ite-postgres-img"
HOST_PORT=5433
DB_USER="ite_user"
DB_PASSWORD="ite_password"
DB_NAME="ite_db"
MAX_RETRIES=20
RETRY_DELAY=2

# --- Colors ---
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m'

printf "\n${CYAN}=== ITE PostgreSQL Setup ===${NC}\n"

# ---------- Pre-flight: Docker must be running ----------
if ! docker info > /dev/null 2>&1; then
    printf "${RED}ERROR: Docker is not running. Please start Docker Desktop and try again.${NC}\n"
    exit 1
fi

# ---------- Stop & remove existing container if present ----------
existing=$(docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" 2>/dev/null || true)
if [ "$existing" = "$CONTAINER_NAME" ]; then
    printf "${YELLOW}Removing existing container '${CONTAINER_NAME}'...${NC}\n"
    docker rm -f "$CONTAINER_NAME" > /dev/null
fi

# ---------- Build the image ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/../docker"
printf "${GREEN}Building Docker image '${IMAGE_NAME}' from ${DOCKER_DIR} ...${NC}\n"
if ! docker build -t "$IMAGE_NAME" "$DOCKER_DIR"; then
    printf "${RED}ERROR: Docker build failed.${NC}\n"
    exit 1
fi

# ---------- Run the container ----------
printf "${GREEN}Starting container '${CONTAINER_NAME}' on port ${HOST_PORT} ...${NC}\n"
if ! docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${HOST_PORT}:5432" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    "$IMAGE_NAME" > /dev/null; then
    printf "${RED}ERROR: Failed to start container.${NC}\n"
    exit 1
fi

# ---------- Wait for PostgreSQL to accept connections ----------
printf "${YELLOW}Waiting for PostgreSQL to be ready...${NC}\n"

ready=false
for i in $(seq 1 "$MAX_RETRIES"); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        ready=true
        break
    fi
    printf "  Attempt %s/%s - not ready yet, retrying in %ss...\n" "$i" "$MAX_RETRIES" "$RETRY_DELAY"
    sleep "$RETRY_DELAY"
done

if [ "$ready" != "true" ]; then
    printf "${RED}ERROR: PostgreSQL did not become ready after %s attempts.${NC}\n" "$MAX_RETRIES"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# ---------- Verify connectivity with a real query ----------
printf "${YELLOW}Verifying database connectivity...${NC}\n"
if ! query_result=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM items;" 2>&1); then
    printf "${RED}ERROR: Could not query the database.${NC}\n"
    echo "$query_result"
    exit 1
fi

printf "\n${GRAY}%s${NC}\n" "$query_result"
printf "\n${GREEN}PostgreSQL is UP and connectable!${NC}\n"
echo "  Host     : localhost"
echo "  Port     : ${HOST_PORT}"
echo "  Database : ${DB_NAME}"
echo "  User     : ${DB_USER}"
echo "  Password : ${DB_PASSWORD}"
printf "\n${CYAN}Connection string: postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${HOST_PORT}/${DB_NAME}${NC}\n"
echo ""
