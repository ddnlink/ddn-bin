#!/bin/bash

echo "Installing dependencies for ddn-bin..."
npm install

echo "Building ddn-bin..."
npm run build

echo "Creating symlink..."
npm link

echo "Installation complete. You can now use 'ddn-bin' command."
