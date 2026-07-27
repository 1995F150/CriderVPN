#!/bin/bash
# CriderShield Uninstaller

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./uninstall.sh)"
  exit 1
fi

echo "--> Stopping and disabling CriderShield service..."
systemctl stop cridershield
systemctl disable cridershield

echo "--> Removing systemd service file..."
rm /etc/systemd/system/cridershield.service
systemctl daemon-reload

echo "--> CriderShield service has been uninstalled."
echo "--> The application files and SQLite data in $(pwd) have been preserved."
echo "--> You can manually delete this folder if you wish to completely remove all data."
