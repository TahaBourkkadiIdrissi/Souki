FROM node:22-bookworm-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/livreur/package.json apps/livreur/package.json
RUN pnpm --filter @souki/livreur... install --frozen-lockfile
COPY apps/livreur/ apps/livreur/
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
RUN pnpm --filter @souki/livreur build
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/livreur/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/livreur/.next/static ./apps/livreur/.next/static
COPY --from=build --chown=node:node /repo/apps/livreur/public ./apps/livreur/public
USER node
EXPOSE 3000
CMD ["node", "apps/livreur/server.js"]
