FROM node:24-alpine AS build

WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --from=build /app/dist ./dist
# preview도 allowedHosts를 검사하므로 설정 파일이 런타임 스테이지에 있어야 한다.
COPY vite.config.ts ./

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
