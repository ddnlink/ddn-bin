#!/bin/bash

echo "Installing dependencies for ddn-scripts..."
npm install

echo "Building ddn-scripts..."
npm run build

echo "Creating symlink..."
npm link

echo "Installation complete. You can now use 'ddn-scripts' command."
