#!/bin/sh
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin@thehive.local","password":"12345@"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

echo "=== Rebuilding cases index ==="
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/index/cases/rebuild \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Rebuilding alerts index ==="
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/index/alerts/rebuild \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Rebuilding observables index ==="
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/index/observables/rebuild \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Rebuilding tasks index ==="
curl -s -X POST http://127.0.0.1:8080/api/v1/admin/index/tasks/rebuild \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Waiting 5s for indexing ==="
sleep 5

echo ""
echo "=== OpenSearch index counts ==="
curl -s http://127.0.0.1:9200/_cat/indices?v

echo ""
echo "=== PostgreSQL counts ==="
docker exec thehive-postgres psql -U thehive -d thehive -c "SELECT 'cases' as tbl, count(*) FROM cases UNION ALL SELECT 'alerts', count(*) FROM alerts UNION ALL SELECT 'observables', count(*) FROM observables UNION ALL SELECT 'task_items', count(*) FROM task_items;"
