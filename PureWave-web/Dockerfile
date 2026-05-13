# 1. Use a standard Linux machine with Node.js pre-installed
FROM node:18-bullseye

# 2. Force the installation of Python and FFmpeg (No skipping allowed!)
RUN apt-get update && apt-get install -y python3 python-is-python3 ffmpeg

# 3. Create a directory for your app
WORKDIR /app

# 4. Copy your package.json first
COPY package*.json ./

# 5. Install the Node packages (This will now succeed because Python is installed)
RUN npm install

# 6. Copy the rest of your backend code
COPY . .

# 7. Start the server
CMD ["node", "server.js"]
