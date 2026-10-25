FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /opt/cognelo

# Keep the runner dependency graph reproducible while avoiding the rest of the
# application source in this image. The Playwright image already contains the
# matching browser binaries and OS libraries; npm installs the JS package.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/web-design-runner/package.json packages/web-design-runner/package.json
RUN npm ci --workspace @cognelo/web-design-runner --include-workspace-root=false

# The service runs Chromium directly; package-manager tooling and the other
# browser engines/media plugins are not runtime dependencies.
RUN apt-get purge -y gstreamer1.0-plugins-bad libgstreamer-plugins-bad1.0-0 \
    && npm cache clean --force \
    && rm -rf /usr/lib/node_modules/npm /usr/local/lib/node_modules/npm \
      /ms-playwright/firefox-* /ms-playwright/webkit-* /var/lib/apt/lists/*

COPY packages/web-design-runner packages/web-design-runner

RUN chown -R pwuser:pwuser /opt/cognelo
USER pwuser

ENV NODE_ENV=production
ENV PORT=3456

EXPOSE 3456

CMD ["node", "--import", "tsx", "packages/web-design-runner/src/index.ts"]
