#!/bin/bash
set -e

echo "Starting bootstrap process..."

# Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432 -U mcp_user; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "PostgreSQL is ready. Running bootstrap..."

# Run the bootstrap script
cd /app
node bootstrap.js

echo "Bootstrap completed successfully!"