FROM node:22-bookworm-slim AS docs-dev
WORKDIR /workspace/docs-site

COPY docs-site/package*.json ./
RUN npm ci

COPY docs-site/ ./

EXPOSE 4321

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4321"]
