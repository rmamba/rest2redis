FROM node:20-slim

WORKDIR /usr/src/app

COPY index.html .
COPY server.js .
COPY package.json .
RUN yarn install --production

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD ["node", "server.js"]
