#!/bin/bash

# Verification script for auth redirects
# This script check if accessing /admin without cookies returns a redirect

FRONTEND_URL=${1:-"http://localhost:3000"}

echo "🔍 Verifying unauthenticated redirect for $FRONTEND_URL/admin..."

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/admin")

if [ "$STATUS_CODE" == "307" ] || [ "$STATUS_CODE" == "302" ]; then
    echo "✅ Success: Received redirect status ($STATUS_CODE)"
else
    echo "❌ Failure: Received unexpected status code ($STATUS_CODE)"
    exit 1
fi

LOCATION=$(curl -s -I "$FRONTEND_URL/admin" | grep -i "location" | awk '{print $2}' | tr -d '\r')

if [[ "$LOCATION" == *"/login"* ]]; then
    echo "✅ Success: Redirected to login page ($LOCATION)"
else
    echo "❌ Failure: Redirected to unexpected location ($LOCATION)"
    exit 1
fi

echo "🎉 Auth redirect verification passed!"
