#!/bin/bash
# Quick Deploy Script for Windows PowerShell
# Run this script to deploy your task manager to GitHub Pages

echo "🚀 Starting deployment process..."
echo ""

# Check if git is initialized
if (!(Test-Path .git)) {
    Write-Host "📁 Initializing Git repository..." -ForegroundColor Green
    git init
}

# Add all files
Write-Host "📦 Adding all files to Git..." -ForegroundColor Green
git add .

# Create commit with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host "💾 Creating commit..." -ForegroundColor Green
git commit -m "🚀 Deploy: Production ready task manager ($timestamp)

✨ Features included:
- Professional UI without emojis
- Custom delete confirmation modal  
- Smart notifications (only on changes)
- Firebase real-time sync
- Mobile responsive design
- Dark/light mode support
- Auto-save functionality"

# Set main branch
Write-Host "🌿 Setting main branch..." -ForegroundColor Green  
git branch -M main

# Add remote if not exists
try {
    git remote get-url origin | Out-Null
    Write-Host "🔗 Remote origin already exists" -ForegroundColor Yellow
} catch {
    Write-Host "🔗 Adding remote origin..." -ForegroundColor Green
    git remote add origin https://github.com/Glenferdinza/productiv.git
}

# Push to GitHub
Write-Host "📤 Pushing to GitHub..." -ForegroundColor Green
try {
    git push -u origin main
    Write-Host ""
    Write-Host "✅ SUCCESS! Deployment completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 Your live website will be available at:" -ForegroundColor Cyan
    Write-Host "   https://glenferdinza.github.io/productiv/" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Go to GitHub.com repository settings" -ForegroundColor White
    Write-Host "2. Enable GitHub Pages (source: main branch)" -ForegroundColor White
    Write-Host "3. Wait 2-5 minutes for deployment" -ForegroundColor White
    Write-Host "4. Test your live website!" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Push failed. Please check:" -ForegroundColor Red
    Write-Host "1. GitHub authentication (run: gh auth login)" -ForegroundColor White
    Write-Host "2. Repository exists at: https://github.com/Glenferdinza/productiv" -ForegroundColor White
    Write-Host "3. Internet connection" -ForegroundColor White
    Write-Host ""
}

Write-Host "🎉 Script completed!" -ForegroundColor Magenta