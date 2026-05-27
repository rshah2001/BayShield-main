FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY python-agents/requirements.txt ./python-agents/requirements.txt

RUN corepack enable \
  && pnpm install --frozen-lockfile

RUN python3 -m pip install --break-system-packages -r python-agents/requirements.txt

COPY . .

RUN pnpm build

EXPOSE 8080

CMD ["pnpm", "start"]
