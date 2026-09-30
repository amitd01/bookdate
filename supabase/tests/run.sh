#!/usr/bin/env bash
# Applies all migrations to a throwaway database and runs the scenario checks.
# Needs Postgres + PostGIS. Connection via standard PG* env vars.
set -euo pipefail
cd "$(dirname "$0")"
DB=bookdate_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -c "drop role if exists anon; drop role if exists authenticated" 2>/dev/null || true
psql -q -v ON_ERROR_STOP=1 -d $DB -f shim.sql
for f in ../migrations/*.sql; do
  # pg_net is stubbed by shim.sql; skip its CREATE EXTENSION.
  sed '/create extension if not exists pg_net/d' "$f" | psql -q -v ON_ERROR_STOP=1 -d $DB
done
psql -qtA -o /dev/null -v ON_ERROR_STOP=1 -d $DB -f scenarios.sql 2>&1 | sed "s/.*NOTICE:  //"
echo "✅ all database scenarios passed"
