# v0.3
FROM node:20

# Set working directory
WORKDIR /app

# Install only the required dependencies
RUN npm install express axios cheerio dotenv express-basic-auth

# Copy all files
COPY server.js .
COPY results.json .
COPY searches.json .
COPY public ./public

# Expose the port your app listens on
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
