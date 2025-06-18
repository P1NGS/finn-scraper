FROM node:20

# Set working directory
WORKDIR /app

# Copy all files
COPY server.js .
COPY results.json .
COPY searches.json .
COPY public ./public

# Install only the required dependencies
RUN npm install express axios cheerio dotenv

# Expose the port your app listens on
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
