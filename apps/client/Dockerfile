FROM node:22-bookworm-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/client/package.json apps/client/package.json
RUN pnpm --filter @souki/client... install --frozen-lockfile
COPY apps/client/ apps/client/
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
RUN pnpm --filter @souki/client build
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /repo/apps/client/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/client/.next/static ./apps/client/.next/static
COPY --from=build --chown=node:node /repo/apps/client/public ./apps/client/public
USER node
EXPOSE 3000
CMD ["node", "apps/client/server.js"]
