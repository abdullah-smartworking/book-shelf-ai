#!/usr/bin/env bash
#
# Day 1 demo script — exercises every endpoint against a running server.
#
#   Terminal 1:  npm run dev
#   Terminal 2:  ./scripts/smoke.sh
#
# Screenshot the output of this for the submission checklist ("Quick demo").
#
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

# check <description> <expected-status> <curl args...>
check() {
  local description="$1" expected="$2"
  shift 2

  local body status
  body="$(curl -sS -w $'\n%{http_code}' "$@" 2>&1)" || {
    red "  ✗ ${description} — curl failed"
    FAIL=$((FAIL + 1))
    return
  }
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [[ "$status" == "$expected" ]]; then
    green "  ✓ ${description} → ${status}"
    PASS=$((PASS + 1))
  else
    red "  ✗ ${description} → got ${status}, expected ${expected}"
    FAIL=$((FAIL + 1))
  fi

  # Pretty-print if node is available, otherwise raw.
  if [[ -n "$body" ]]; then
    if command -v node >/dev/null 2>&1; then
      node -e '
        let raw = "";
        process.stdin.on("data", (c) => (raw += c));
        process.stdin.on("end", () => {
          try {
            const text = JSON.stringify(JSON.parse(raw), null, 2);
            console.log(text.split("\n").slice(0, 14).map((l) => "    " + l).join("\n"));
          } catch {
            console.log("    " + raw.slice(0, 400));
          }
        });
      ' <<<"$body"
    else
      echo "    ${body:0:400}"
    fi
  fi
  echo
}

bold "BookShelf API smoke test — ${BASE}"
echo

if ! curl -sS -o /dev/null "${BASE}/health" 2>/dev/null; then
  red "Server is not responding at ${BASE}."
  echo "Start it first:  npm run dev"
  exit 1
fi

bold "1. Health"
check "GET /health" 200 "${BASE}/health"

bold "2. List books"
check "GET /api/books" 200 "${BASE}/api/books"
check "GET /api/books?genre=Fantasy&sort=year&order=asc" 200 "${BASE}/api/books?genre=Fantasy&sort=year&order=asc"
check "GET /api/books?limit=2&page=2" 200 "${BASE}/api/books?limit=2&page=2"
check "GET /api/books?limit=9999 (rejected)" 400 "${BASE}/api/books?limit=9999"

bold "3. Search"
check "GET /api/books/search?q=dune" 200 "${BASE}/api/books/search?q=dune"
check "GET /api/books/search?q=ishiguro (author match)" 200 "${BASE}/api/books/search?q=ishiguro"
check "GET /api/books/search (no q, rejected)" 400 "${BASE}/api/books/search"

bold "4. Single book"
check "GET /api/books/book_001 (with reviews)" 200 "${BASE}/api/books/book_001"
check "GET /api/books/book_999 (not found)" 404 "${BASE}/api/books/book_999"

bold "5. Create a book"
NEW_TITLE="Smoke Test $(date +%s)"
check "POST /api/books" 201 \
  -X POST "${BASE}/api/books" \
  -H 'content-type: application/json' \
  -d "{\"title\":\"${NEW_TITLE}\",\"author\":\"Smoke Tester\",\"genre\":\"Technology\",\"year\":2026}"

check "POST /api/books (missing title, rejected)" 400 \
  -X POST "${BASE}/api/books" \
  -H 'content-type: application/json' \
  -d '{"author":"Nobody","genre":"Fiction","year":2020}'

check "POST /api/books (duplicate ISBN, conflict)" 409 \
  -X POST "${BASE}/api/books" \
  -H 'content-type: application/json' \
  -d '{"title":"Dune again","author":"Frank Herbert","genre":"Science Fiction","year":1965,"isbn":"978-0441013593"}'

check "POST /api/books (malformed JSON)" 400 \
  -X POST "${BASE}/api/books" \
  -H 'content-type: application/json' \
  -d '{"title": "unclosed'

bold "6. Confirm the new book persisted"
check "GET /api/books/search?q=smoke" 200 "${BASE}/api/books/search?q=smoke"

bold "7. Unknown route"
check "GET /api/nope" 404 "${BASE}/api/nope"

echo "────────────────────────────────"
bold "${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]] || exit 1
