ARG JUDGE0_BASE_IMAGE=judge0/judge0:1.13.1
FROM ${JUDGE0_BASE_IMAGE}

USER root
COPY infra/judge0/configure-languages.sql /api/cognelo-configure-languages.sql
# The upstream startup scripts write the cron environment through tee, which
# otherwise exposes service credentials in container logs. Fail if the upstream
# script layout changes so an upgrade cannot silently drop this protection.
RUN for service in server workers; do \
      script="/api/scripts/$service"; \
      grep -Fqx 'source ./scripts/load-config' "$script" \
      && sed -i 's@^source ./scripts/load-config$@source ./scripts/load-config\nexport ENABLE_WAIT_RESULT=false@' "$script" \
      && grep -Fqx 'export | sudo tee /api/environment' "$script" \
      && sed -i 's@^export | sudo tee /api/environment$@umask 077\nexport > /api/environment || exit 1@' "$script" \
      || exit 1; \
    done
# Cron cleans worker sandbox files; the HTTP API needs neither cron nor sudo.
RUN install -o judge0 -g judge0 -m 600 /dev/null /api/environment \
    && grep -Fqx 'sudo cron' /api/docker-entrypoint.sh \
    && sed -i 's@^sudo cron$@case "$1" in */workers) sudo cron ;; esac@' /api/docker-entrypoint.sh \
    && rm -rf /usr/local/node-*/lib/node_modules/npm /usr/local/lib/node_modules/npm /usr/lib/node_modules/npm
# Upstream seeding can reset compile commands on every API restart. Restore the
# required libraries before accepting requests, including on existing volumes.
RUN grep -Fqx '    rails db:create db:migrate db:seed' /api/scripts/server \
    && sed -i 's@^    rails db:create db:migrate db:seed$@    rails db:create db:migrate db:seed \&\& rails runner "ActiveRecord::Base.connection.execute(File.read(%q{/api/cognelo-configure-languages.sql}))" || exit 1@' /api/scripts/server
USER judge0
