FROM node:22-bookworm-slim AS workspace-base
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY apps/cli/package*.json apps/cli/
COPY docs-site/package*.json docs-site/
COPY packages/adapters/package*.json packages/adapters/
COPY packages/application/package*.json packages/application/
COPY packages/config/package*.json packages/config/
COPY packages/domain/package*.json packages/domain/
COPY packages/shared/package*.json packages/shared/

RUN npm ci

FROM workspace-base AS web-dev
WORKDIR /workspace
COPY . .

ENV NEXT_PUBLIC_API_BASE_URL=/api
ENV API_PROXY_TARGET=http://api:3040

EXPOSE 3050

CMD ["npm", "run", "dev:docker", "--workspace", "@mergewright/web"]
