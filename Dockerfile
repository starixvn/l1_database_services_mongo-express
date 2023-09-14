FROM hub.lumigame.com/docker-hub/library/node:18.1-alpine AS builder

WORKDIR /app
COPY . .

RUN npm run reg \
    && yarn install \
    && yarn build \
    && rm -rf /app/lib/scripts

FROM hub.lumigame.com/docker-hub/library/node:18.1-alpine
RUN apk -U add --no-cache bash tini curl
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
RUN mkdir /app && chown node:node /app
WORKDIR /app


COPY --from=builder /app/build /app/build/
COPY --from=builder /app/public /app/public/
COPY --from=builder /app/lib /app/lib/
COPY --from=builder /app/app.js /app/
COPY --from=builder /app/config.default.js /app/
COPY --from=builder /app/*.json /app/
COPY --from=builder /app/.yarn /app/.yarn/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/
COPY --from=builder /app/.npmignore /app/
RUN yarn workspaces focus --production

USER node
ENV PATH /app/node_modules/.bin:$PATH

HEALTHCHECK --interval=10s CMD curl --fail http://localhost:5000/status || exit 1

EXPOSE 5000

CMD ["/sbin/tini", "--", "yarn", "start"]
