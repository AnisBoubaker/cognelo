FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /opt/cognelo

# Keep the runner dependency graph reproducible while avoiding the rest of the
# application source in this image. The Playwright image already contains the
# matching browser binaries and OS libraries; npm installs the JS package.
COPY package.json package-lock.json ./
COPY packages/web-design-runner/package.json packages/web-design-runner/package.json
RUN npm ci --workspace @cognelo/web-design-runner --include-workspace-root=false

COPY packages/web-design-runner packages/web-design-runner

RUN chown -R pwuser:pwuser /opt/cognelo
USER pwuser

ENV NODE_ENV=production
ENV PORT=3456

EXPOSE 3456

CMD ["npm", "run", "start", "--workspace", "@cognelo/web-design-runner"]
