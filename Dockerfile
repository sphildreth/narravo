# Dockerfile — Next.js (App Router) + pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME=/root/.pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN npm install --global pnpm@11.5.2 \
    && addgroup -S --gid 10001 narravo \
    && adduser -S --uid 10001 --ingroup narravo --home /home/narravo narravo
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/next.config.mjs ./next.config.mjs
COPY --from=base /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=base /app/drizzle ./drizzle
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/src ./src
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Create upload directory structure with proper permissions
RUN mkdir -p /app/public/uploads/images /app/public/uploads/videos /app/public/uploads/featured && \
    chown -R narravo:narravo /app /entrypoint.sh && \
    chmod 755 /entrypoint.sh && chmod -R u+rwX,go+rX /app/public/uploads
USER narravo
EXPOSE 3000
CMD ["/entrypoint.sh"]
