#!/bin/bash
# Vercel Build Script for SmartHire AI Monorepo
# This script ensures the frontend is built from the root directory

set -e

echo "Starting build for SmartHire AI..."
echo "PWD: $(pwd)"
echo "Root directory contents:"
ls -la | head -20

# Navigate to frontend and install/build
echo "Installing dependencies in frontend..."
cd frontend
npm install
echo "Building Next.js application..."
npm run build

echo "Build completed successfully!"
