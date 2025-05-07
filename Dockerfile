FROM node:18

RUN apt update && \
    apt install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install

CMD ["node", "server.js"]
