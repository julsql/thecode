# Étape 1 : Build Vue
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Étape 2 : Serve avec Nginx
FROM nginx:alpine
# L'image amont peut avoir un temps de retard sur les correctifs d'Alpine
# (libexpat, CVE-2026-93990) : on applique ceux déjà publiés.
RUN apk upgrade --no-cache
# Copie du build Vue
COPY --from=build /app/dist /usr/share/nginx/html
# Copie de la config Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
