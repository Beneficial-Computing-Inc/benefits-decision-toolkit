#!/bin/sh
set -e

# Support flexible API configuration for Railway and local development
# API_URL takes precedence if set (e.g., "http://library-api:8080")
# Otherwise, construct from API_HOST and API_PORT
export API_HOST=${API_HOST:-library-api}
export API_PORT=${API_PORT:-8080}
export API_URL=${API_URL:-http://${API_HOST}:${API_PORT}}

# Substitute environment variables in nginx config
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
