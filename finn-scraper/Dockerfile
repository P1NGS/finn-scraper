FROM node:20
WORKDIR /app
COPY . .
RUN npm install express axios cheerio
EXPOSE 8080
CMD ["node", "server.js"]
