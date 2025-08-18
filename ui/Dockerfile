FROM node:18-alpine as builder

WORKDIR /app

# Accept build argument for MCP server URL
ARG VITE_MCP_SERVER_URL
ENV VITE_MCP_SERVER_URL=$VITE_MCP_SERVER_URL

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM nginx:stable-alpine

# Copy the built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
