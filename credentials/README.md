# Credentials Directory

This directory stores sensitive credentials that should NEVER be committed to git.

## Files that belong here:

- `service-account.json` - Google Cloud Service Account key

## Setup Instructions:

1. Download your service account key from GCP Console
2. Save it as `service-account.json` in this directory
3. The `.gitignore` ensures this file is never committed

## Security Warning ⚠️

- Never share these credentials
- Never commit them to git
- Rotate keys periodically in production
