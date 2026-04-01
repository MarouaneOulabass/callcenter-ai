#!/bin/bash
# ===========================================
# CallCenter AI — Tests E2E reels
# ===========================================

BASE_URL="http://localhost:3000"
# Load from .env.local
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)}"
CURL_OPTS="--ssl-no-revoke"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_case() {
  TOTAL=$((TOTAL + 1))
  echo ""
  echo -e "${YELLOW}TEST #${TOTAL}: $1${NC}"
}

pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}FAIL${NC} — $1"
}

echo "==========================================="
echo " CallCenter AI — Tests E2E"
echo " Target: $BASE_URL"
echo "==========================================="

# ------------------------------------------
# TEST 1-3: Pages load
# ------------------------------------------
for page in "/" "/login" "/register"; do
  test_case "Page $page loads"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$page")
  if [ "$STATUS" = "200" ]; then
    pass "Returns 200"
  else
    fail "Returns $STATUS"
  fi
done

# ------------------------------------------
# TEST 4: Sign up user via Supabase Admin API
# ------------------------------------------
test_case "Create test user via Supabase Admin API"
TEST_EMAIL="e2e-test-$(date +%s)@gmail.com"
TEST_PASSWORD="TestPass123!"

SIGNUP_RESPONSE=$(curl $CURL_OPTS -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"email_confirm\":true}")

USER_ID=$(echo "$SIGNUP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$USER_ID" ] && [ ${#USER_ID} -gt 10 ]; then
  pass "User created: $USER_ID ($TEST_EMAIL)"
else
  fail "Signup failed: $(echo $SIGNUP_RESPONSE | head -c 200)"
fi

# ------------------------------------------
# TEST 5: Create workspace via /api/auth/setup
# ------------------------------------------
test_case "Create workspace via /api/auth/setup"
SETUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/setup" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"email\":\"$TEST_EMAIL\",\"companyName\":\"Maroc Digital SARL\",\"language\":\"fr\",\"tone\":\"neutral\"}")

WORKSPACE_ID=$(echo "$SETUP_RESPONSE" | grep -o '"workspaceId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$WORKSPACE_ID" ] && [ ${#WORKSPACE_ID} -gt 10 ]; then
  pass "Workspace created: $WORKSPACE_ID"
else
  fail "Workspace creation failed: $SETUP_RESPONSE"
fi

# ------------------------------------------
# TEST 6: Login and get access token
# ------------------------------------------
test_case "Login with test user"
LOGIN_RESPONSE=$(curl $CURL_OPTS -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ] && [ ${#ACCESS_TOKEN} -gt 20 ]; then
  pass "Login OK, got access token (${#ACCESS_TOKEN} chars)"
else
  fail "Login failed: $(echo $LOGIN_RESPONSE | head -c 200)"
fi

# Build auth cookie name
AUTH_COOKIE="sb-hrpaxxweuccogoexzqtx-auth-token"

# ------------------------------------------
# TEST 7-9: Add 3 FAQ entries
# ------------------------------------------
FAQS=(
  '{"question":"Quels sont vos horaires ?","answer":"Nous sommes ouverts du lundi au vendredi de 9h a 18h, et le samedi de 10h a 14h."}'
  '{"question":"Comment contacter le service client ?","answer":"Appelez le 05 22 33 44 55, envoyez un email a contact@marocdigital.ma, ou utilisez le chat sur notre site."}'
  '{"question":"Quels services proposez-vous ?","answer":"Nous proposons du conseil en transformation digitale, developpement web et mobile, et integration de solutions IA pour les entreprises marocaines."}'
)
FAQ_IDS=()

for i in 0 1 2; do
  test_case "Add FAQ #$((i+1))"
  FAQ_RESPONSE=$(curl -s -X POST "$BASE_URL/api/knowledge/faq" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "${FAQS[$i]}")

  FAQ_STATUS=$(echo "$FAQ_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  FAQ_ID=$(echo "$FAQ_RESPONSE" | grep -o '"sourceId":"[^"]*"' | cut -d'"' -f4)
  FAQ_IDS+=("$FAQ_ID")

  if [ "$FAQ_STATUS" = "completed" ]; then
    pass "FAQ vectorized OK (sourceId: ${FAQ_ID:0:8}...)"
  else
    fail "FAQ failed: $FAQ_RESPONSE"
  fi
done

# ------------------------------------------
# TEST 10: List knowledge sources
# ------------------------------------------
test_case "List knowledge sources (expect 3)"
SOURCES_RESPONSE=$(curl -s "$BASE_URL/api/knowledge" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

SOURCE_COUNT=$(echo "$SOURCES_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$SOURCE_COUNT" -ge 3 ]; then
  pass "Found $SOURCE_COUNT sources"
else
  fail "Expected 3+, got $SOURCE_COUNT. Response: $(echo $SOURCES_RESPONSE | head -c 200)"
fi

# ------------------------------------------
# TEST 11: Widget config (public, no auth)
# ------------------------------------------
test_case "Widget config endpoint (public)"
CONFIG_RESPONSE=$(curl -s "$BASE_URL/api/widget?token=$WORKSPACE_ID")
CONFIG_NAME=$(echo "$CONFIG_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [ "$CONFIG_NAME" = "Maroc Digital SARL" ]; then
  pass "Widget config OK: name=$CONFIG_NAME"
else
  fail "Widget config failed: $CONFIG_RESPONSE"
fi

# ------------------------------------------
# TEST 12: Chat via widget — question with answer in KB
# ------------------------------------------
test_case "Widget chat — question about opening hours"
CHAT1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/widget" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Bonjour, quels sont vos horaires d'ouverture ?\",\"token\":\"$WORKSPACE_ID\"}")

CHAT1_REPLY=$(echo "$CHAT1_RESPONSE" | grep -o '"reply":"' | head -1)
CONV_ID=$(echo "$CHAT1_RESPONSE" | grep -o '"conversation_id":"[^"]*"' | cut -d'"' -f4)
CHAT1_ESCALATED=$(echo "$CHAT1_RESPONSE" | grep -o '"escalated":false')

if [ -n "$CHAT1_REPLY" ] && [ -n "$CONV_ID" ]; then
  # Extract reply text for display
  REPLY_TEXT=$(echo "$CHAT1_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply'][:120])" 2>/dev/null || echo "(reply received)")
  pass "Reply: $REPLY_TEXT..."
else
  fail "Chat failed: $CHAT1_RESPONSE"
fi

# ------------------------------------------
# TEST 13: Chat follow-up (same conversation)
# ------------------------------------------
test_case "Widget chat — follow-up in same conversation"
CHAT2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/widget" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Et comment je peux vous joindre par telephone ?\",\"conversation_id\":\"$CONV_ID\",\"token\":\"$WORKSPACE_ID\"}")

CHAT2_REPLY=$(echo "$CHAT2_RESPONSE" | grep -o '"reply":"' | head -1)
CHAT2_CONV=$(echo "$CHAT2_RESPONSE" | grep -o '"conversation_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CHAT2_REPLY" ] && [ "$CHAT2_CONV" = "$CONV_ID" ]; then
  REPLY_TEXT=$(echo "$CHAT2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply'][:120])" 2>/dev/null || echo "(reply received)")
  pass "Follow-up (same conv): $REPLY_TEXT..."
else
  fail "Follow-up failed: $CHAT2_RESPONSE"
fi

# ------------------------------------------
# TEST 14: Chat — question hors contexte
# ------------------------------------------
test_case "Widget chat — question outside KB (should admit not knowing)"
CHAT3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/widget" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Combien coute votre forfait premium entreprise ?\",\"token\":\"$WORKSPACE_ID\"}")

CHAT3_REPLY=$(echo "$CHAT3_RESPONSE" | grep -o '"reply":"' | head -1)

if [ -n "$CHAT3_REPLY" ]; then
  REPLY_TEXT=$(echo "$CHAT3_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply'][:150])" 2>/dev/null || echo "(reply received)")
  pass "Out-of-scope reply: $REPLY_TEXT..."
else
  fail "Out-of-scope chat failed: $CHAT3_RESPONSE"
fi

# ------------------------------------------
# TEST 15: Chat — question about services (should use KB)
# ------------------------------------------
test_case "Widget chat — question about services (should use KB)"
CHAT4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/widget" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Quels sont les services que vous proposez ?\",\"token\":\"$WORKSPACE_ID\"}")

CHAT4_REPLY=$(echo "$CHAT4_RESPONSE" | grep -o '"reply":"' | head -1)

if [ -n "$CHAT4_REPLY" ]; then
  REPLY_TEXT=$(echo "$CHAT4_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['reply'][:150])" 2>/dev/null || echo "(reply received)")
  pass "Services reply: $REPLY_TEXT..."
else
  fail "Services chat failed: $CHAT4_RESPONSE"
fi

# ------------------------------------------
# TEST 16: Get workspace settings (authenticated)
# ------------------------------------------
test_case "Get workspace settings (authenticated)"
WS_RESPONSE=$(curl -s "$BASE_URL/api/workspace" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

WS_LANG=$(echo "$WS_RESPONSE" | grep -o '"language":"[^"]*"' | cut -d'"' -f4)
WS_TONE=$(echo "$WS_RESPONSE" | grep -o '"tone":"[^"]*"' | cut -d'"' -f4)
WS_NAME=$(echo "$WS_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [ "$WS_LANG" = "fr" ] && [ "$WS_TONE" = "neutral" ]; then
  pass "Workspace: name=$WS_NAME, lang=$WS_LANG, tone=$WS_TONE"
else
  fail "Workspace settings: $WS_RESPONSE"
fi

# ------------------------------------------
# TEST 17: Update workspace (change tone to formal)
# ------------------------------------------
test_case "Update workspace tone to formal"
UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/workspace" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"tone\":\"formal\"}")

UPDATED_TONE=$(echo "$UPDATE_RESPONSE" | grep -o '"tone":"[^"]*"' | cut -d'"' -f4)

if [ "$UPDATED_TONE" = "formal" ]; then
  pass "Tone updated to: formal"
else
  fail "Update failed: $UPDATE_RESPONSE"
fi

# ------------------------------------------
# TEST 18: List conversations (should have some from chat tests)
# ------------------------------------------
test_case "List conversations (expect 3+)"
CONV_RESPONSE=$(curl -s "$BASE_URL/api/conversations" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

CONV_COUNT=$(echo "$CONV_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$CONV_COUNT" -ge 3 ]; then
  pass "Found $CONV_COUNT conversations"
else
  fail "Expected 3+, got $CONV_COUNT"
fi

# ------------------------------------------
# TEST 19: Get messages for a conversation
# ------------------------------------------
test_case "Get messages for conversation"
MSG_RESPONSE=$(curl -s "$BASE_URL/api/conversations/$CONV_ID/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

MSG_COUNT=$(echo "$MSG_RESPONSE" | grep -o '"role"' | wc -l)

if [ "$MSG_COUNT" -ge 2 ]; then
  pass "Found $MSG_COUNT messages in conversation"
else
  fail "Expected 2+ messages, got $MSG_COUNT"
fi

# ------------------------------------------
# TEST 20: Delete a FAQ source
# ------------------------------------------
test_case "Delete FAQ source"
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/knowledge" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"sourceId\":\"${FAQ_IDS[0]}\"}")

DELETE_OK=$(echo "$DELETE_RESPONSE" | grep -o '"success":true')

if [ -n "$DELETE_OK" ]; then
  pass "FAQ source deleted"
else
  fail "Delete failed: $DELETE_RESPONSE"
fi

# ------------------------------------------
# TEST 21: Verify source count = 2 after delete
# ------------------------------------------
test_case "Verify source count after deletion (expect 2)"
SOURCES2_RESPONSE=$(curl -s "$BASE_URL/api/knowledge" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

SOURCE2_COUNT=$(echo "$SOURCES2_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$SOURCE2_COUNT" -eq 2 ]; then
  pass "Source count is now 2"
else
  fail "Expected 2, got $SOURCE2_COUNT"
fi

# ------------------------------------------
# TEST 22-23: Webhook endpoints
# ------------------------------------------
test_case "Vapi webhook endpoint"
VAPI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/webhook/vapi" \
  -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"ping\"}}")

if [ "$VAPI_STATUS" = "200" ]; then
  pass "Vapi webhook returns 200"
else
  fail "Vapi webhook returned $VAPI_STATUS"
fi

test_case "WhatsApp webhook endpoint"
WA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/webhook/whatsapp" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+212600000000&Body=Test&To=whatsapp:+1234567890")

if [ "$WA_STATUS" = "200" ]; then
  pass "WhatsApp webhook returns 200"
else
  fail "WhatsApp webhook returned $WA_STATUS"
fi

# ------------------------------------------
# CLEANUP: delete test user
# ------------------------------------------
echo ""
echo -e "${YELLOW}CLEANUP: Deleting test user...${NC}"
curl $CURL_OPTS -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" > /dev/null 2>&1

# ------------------------------------------
# RESULTS
# ------------------------------------------
echo ""
echo "==========================================="
echo -e " RESULTS: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, $TOTAL total"
echo "==========================================="

if [ "$FAIL" -eq 0 ]; then
  echo -e " ${GREEN}ALL TESTS PASSED${NC}"
else
  echo -e " ${RED}SOME TESTS FAILED${NC}"
fi
echo ""
