FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose port if needed for health checks
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]