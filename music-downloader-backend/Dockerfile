# We changed "bullseye" to "bookworm" - this upgrades Python from 3.9 to 3.11!
FROM node:18-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y python3 python-is-python3 ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies safely
RUN npm install --legacy-peer-deps

# Copy the rest of the code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Final start command
CMD ["node", "server.js"]
