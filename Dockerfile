# Builds the BFF (apps/api) only. Build context is the repo root because the
# API depends on the @recetapp/contracts workspace.
#
# Node 22.18+ is required: the server runs TypeScript directly via type
# stripping, with no build step.
FROM node:24-alpine AS deps
WORKDIR /app

# Manifests first so the install layer is cached until dependencies change.
# The mobile manifest is copied only so npm can validate the workspace lockfile;
# its dependencies are not installed.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/

RUN npm ci --omit=dev --workspace @recetapp/api --include-workspace-root=false

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts

USER node
EXPOSE 8787

# GEMINI_API_KEY must be supplied at runtime. It is never baked into the image.
CMD ["npm", "run", "start", "--workspace", "@recetapp/api"]
