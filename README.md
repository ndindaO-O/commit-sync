# CommitSync

A lightweight Discord bot that posts commits made by members of the organization to a Discord channel.

## Features

- Post commits and changes (diff summary) from repositories to a Discord channel
- CI / webhook friendly — receives GitHub webhooks and verifies payloads

## Environment variables

- DISCORD_WEBHOOK_URL — Discord webhook URL to receive commit messages
- GITHUB_WEBHOOK_SECRET — shared secret used to verify GitHub webhook signatures
- PORT — port the bot listens on for incoming webhooks (default: 3000)

Ngrok can be used to expose your local PORT for testing and to register a temporary GitHub webhook endpoint.

## Requirements

- Node.js 16+ (or run in a container via Docker)
- Optional: a GitHub token with repo access if the bot needs to fetch additional data (not required for basic webhook delivery)
- Network access from GitHub to your webhook endpoint (or use ngrok for local testing)

## Quick start

1. Set the required environment variables (DISCORD_WEBHOOK_URL, GITHUB_WEBHOOK_SECRET, PORT).
2. Install dependencies and start the service
3. Configure a GitHub webhook on the repository or organization to send "push" events to `http(s)://<your-host>:<PORT>`.
4. Verify webhook signatures are accepted by the service and watch commits appear in the target Discord channel.
