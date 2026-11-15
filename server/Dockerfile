FROM oven/bun:1.4-alpine

ARG VERSION=dev
ARG REVISION=local
ARG SOURCE_URL=https://github.com/jagawarga/jagawarga

LABEL org.opencontainers.image.title="Jaga Warga API" \
      org.opencontainers.image.description="API komunitas warga: panic/SSE, iuran, pengumuman, donasi" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.licenses="UNLICENSED"

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile || bun install --production

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY scripts ./scripts

# Bukti bayar; di produksi ditimpa volume.
RUN mkdir -p /data/media

ENV NODE_ENV=production \
    PORT=8787 \
    MEDIA_DIR=/data/media

EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8787/api/v1/health || exit 1

CMD ["bun", "src/index.ts"]
