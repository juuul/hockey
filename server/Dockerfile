FROM alpine:3.22
ARG PB_VERSION=0.40.4
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb && rm /tmp/pb.zip \
 && adduser -D -H -u 1000 pb && mkdir -p /pb/pb_data && chown pb /pb/pb_data
# Migraties en hooks zitten in het image: wijzigingen gaan pas live na 'docker compose up -d --build'
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
USER pb
WORKDIR /pb
EXPOSE 8090
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--origins=https://hockey.juliaan.eu,https://juliaan.eu,http://192.168.2.50:5173,http://localhost:5173"]
