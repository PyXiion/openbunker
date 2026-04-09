#!/bin/bash
set -e

# Create zitadel database (ignore if it already exists)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE zitadel'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zitadel')\gexec
EOSQL

echo "Zitadel database creation attempted"

# Create bunker database (ignore if it already exists)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE bunker'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bunker')\gexec
EOSQL

echo "Bunker database creation attempted"

# Run migrations on bunker database
echo "Running bunker database migrations..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "bunker" -f /migrations/001_initial_schema.sql

echo "Bunker database migrations completed"
