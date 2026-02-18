FROM node:25-alpine

WORKDIR /app
RUN apk add git
COPY package*.json yarn.lock ./
RUN yarn install
COPY . .
EXPOSE 3000

CMD ["yarn", "start"]