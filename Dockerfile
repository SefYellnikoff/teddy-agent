# Multi-stage build: compile frontend, then run backend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend . 
RUN npm run build

# Final stage: run backend with built frontend
FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend code
COPY backend ./backend

# Copy built frontend to serve as static files (if needed)
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start backend server
CMD ["node", "backend/index.js"]
