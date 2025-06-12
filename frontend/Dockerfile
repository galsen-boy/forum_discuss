FROM node:16-alpine

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers
COPY . .

# Changer les permissions
RUN chown -R appuser:appgroup /app

# Passer à l'utilisateur non-root
USER appuser

EXPOSE 3000

CMD ["npm", "start"] 