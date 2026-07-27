#!/bin/bash
# CriderShield Installer for Ubuntu Server
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./install.sh)"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "Error: package.json not found! Please ensure you are in the CriderShield root directory."
  exit 1
fi

echo "--> Installing Node.js dependencies..."
npm install

echo "--> Building the Next.js frontend..."
npm run build

echo "--> Configuring SQLite data directory..."
mkdir -p data
chmod 755 data#!/bin/bash
set -e
# CriderShield Installer for Ubuntu Server

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./install.sh)"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "Error: package.json not found! Please ensure you are in the CriderShield root directory."
  exit 1
fi

echo "--> Installing Node.js dependencies..."
npm install

echo "--> Building the Next.js frontend..."
npm run build

echo "--> Configuring SQLite data directory..."
mkdir -p data
chmod 755 data

echo "--> Installing systemd service..."
cp cridershield.service /etc/systemd/system/cridershield.service

echo "--> Reloading systemd and enabling CriderShield service..."
systemctl daemon-reload
systemctl enable cridershield

echo "--> Starting CriderShield..."
systemctl start cridershield

echo "--> CriderShield installed successfully! Access the dashboard at http://your-ip:3000"


echo "--> Installing systemd service..."
cp cridershield.service /etc/systemd/system/cridershield.service

echo "--> Reloading systemd, enabling, and starting CriderShield..."
systemctl daemon-reload
systemctl enable cridershield
systemctl start cridershield

echo "--> CriderShield installed successfully! It will now start automatically on boot."
echo "--> You can check the status with: sudo systemctl status cridershield"
