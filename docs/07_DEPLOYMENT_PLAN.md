# Deployment Plan

## Development

Windows local server on `127.0.0.1:3090`, using `data/ros-dev.sqlite`. This project has no Docker, scheduled task, ngrok tunnel, or legacy service dependency.

## Target production

A small Linux VPS runs one ROS container/service, persistent SQLite volume, TLS reverse proxy, nightly encrypted database backup, structured logs, and health monitoring. The initial deployment should use a single tenant but retain `business_id` boundaries.

Required environment values are represented only by placeholders in `.env.example`: port/host/database path, session secret, and future LINE/OpenAI/Google/n8n values. No credential is committed.
