#!/bin/bash
# Startup script for Internship Tracker

echo "Starting Internship Tracker services..."

# Start backend
echo "Starting backend server..."
nohup npm run dev > backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 3

# Start frontend
echo "Starting frontend server..."
cd internship-frontend
nohup npm start > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Check backend.log and frontend.log for output"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:5000"