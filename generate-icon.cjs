// Simple icon generator for OpenStage
// Creates a 1024x1024 PNG with orange play button

const fs = require('fs');
const { createCanvas } = require('canvas');

const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Background - dark
ctx.fillStyle = '#090909';
ctx.fillRect(0, 0, size, size);

// Outer circle - orange
const centerX = size / 2;
const centerY = size / 2;
const radius = size * 0.35;

ctx.beginPath();
ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
ctx.fillStyle = '#f97316';
ctx.fill();

// Inner circle - dark
const innerRadius = radius * 0.7;
ctx.beginPath();
ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
ctx.fillStyle = '#090909';
ctx.fill();

// Play triangle - orange
const triangleRadius = innerRadius * 0.6;
ctx.beginPath();
ctx.moveTo(centerX - triangleRadius * 0.3, centerY - triangleRadius);
ctx.lineTo(centerX - triangleRadius * 0.3, centerY + triangleRadius);
ctx.lineTo(centerX + triangleRadius * 0.8, centerY);
ctx.closePath();
ctx.fillStyle = '#f97316';
ctx.fill();

// Write PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('src-tauri/icons/icon.png', buffer);
console.log('✓ icon.png created (1024x1024)');
