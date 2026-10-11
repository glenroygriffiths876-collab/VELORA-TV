FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json ./
COPY . .
ENV NODE_ENV=production
EXPOSE 8094
CMD ["npm","start"]
