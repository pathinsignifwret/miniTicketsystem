FROM node:18-alpine

workdir /app

copy package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]