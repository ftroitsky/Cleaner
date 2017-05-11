#!/usr/bin/env bash

export NODE_VERSION="6.9.5"

export PATH="/home/deployer/.nvm/versions/node/v6.9.5/bin:$PATH"

export NVM_DIR="/home/deployer/.nvm"
export NVM_BIN="/home/deployer/.nvm/versions/node/v6.9.5/bin"

echo "--> Installing libraries..."
npm install --production
cp /home/deployer/apps/envs/cleaner.env .env
 
echo "--> Exporting Foreman files..."
rm -rf foreman
mkdir foreman
PORT=5300 nf export bot=1 -o foreman -a cleaner_bot
sudo cp foreman/* /etc/init
 
echo "--> Restarting..."
sudo stop cleaner_bot
sudo start cleaner_bot