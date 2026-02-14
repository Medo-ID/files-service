#!/bin/bash

# Configuration
URL="http://localhost:3000/health" # Update with your port
TOTAL_REQUESTS=120
CONCURRENT_DELAY=0.01 # Small delay to avoid saturating your local OS socket

echo "🚀 Starting stress test against $URL"
echo "----------------------------------------"

for ((i=1; i<=TOTAL_REQUESTS; i++))
do
  # -s: Silent
  # -o /dev/null: Don't print the response body
  # -w: Print the HTTP status code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  
  if [ "$status_code" -eq 200 ]; then
    echo "[$i] ✅ Status: $status_code"
  elif [ "$status_code" -eq 429 ]; then
    echo "[$i] 🛑 Status: $status_code (Rate Limit Hit!)"
  else
    echo "[$i] ❌ Status: $status_code (Error)"
  fi

  sleep $CONCURRENT_DELAY
done

echo "----------------------------------------"
echo "🏁 Test Complete."
