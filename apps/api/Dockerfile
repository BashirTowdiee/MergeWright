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

FROM workspace-base AS api-dev
WORKDIR /workspace
COPY . .

ENV API_HOST=0.0.0.0
ENV API_PORT=3040
ENV ORCHESTRATOR_ROOT=/workspace

EXPOSE 3040

CMD ["sh", "-lc", "npm run build --workspace @mergewright/api && npm run start --workspace @mergewright/api -- --host ${API_HOST} --port ${API_PORT} --orchestrator-root ${ORCHESTRATOR_ROOT}"]
