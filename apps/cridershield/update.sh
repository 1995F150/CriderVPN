#!/bin/bash
# CriderShield Updater

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./update.sh)"
  exit 1
fi

echo "--> Pulling latest changes from GitHub..."
git pull origin main

echo "--> Updating Node.js dependencies..."
npm install

echo "--> Rebuilding the frontend..."
npm run build

echo "--> Restarting CriderShield service..."
systemctl restart cridershield

echo "--> Update complete!"
