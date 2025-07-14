#!/bin/bash
set -e

# Source the original entrypoint
source /usr/local/bin/docker-entrypoint.sh

# Custom initialization function
custom_init() {
    echo "Running custom initialization..."
    
    # Wait a bit for PostgreSQL to be fully ready
    sleep 5
    
    # Run bootstrap script to load schema properties
    cd /app
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
    
    echo "Loading schema properties..."
    node bootstrap.js || echo "Bootstrap script failed, but continuing..."
    
    echo "Custom initialization completed!"
}

# If this is the main postgres process and we're initializing
if [ "$1" = 'postgres' ] && [ -n "$POSTGRES_DB" ]; then
    # Run the original docker-entrypoint.sh initialization
    docker-entrypoint.sh "$@" &
    PG_PID=$!
    
    # Wait for PostgreSQL to be ready
    until pg_isready -h localhost -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
      echo "Waiting for PostgreSQL to be ready..."
      sleep 2
    done
    
    # Run our custom initialization
    custom_init
    
    # Keep PostgreSQL running in foreground
    wait $PG_PID
else
    # For other commands, just run the original entrypoint
    exec docker-entrypoint.sh "$@"
fi