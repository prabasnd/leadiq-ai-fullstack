FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files from backend folder
COPY backend/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend source code
COPY backend .

# Expose port (change if your app uses a different port)
EXPOSE 5000

# Start the app
CMD ["npm", "start"]
