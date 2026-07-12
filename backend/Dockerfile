FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/healthcheck ./cmd/healthcheck

# Create the uploads directory structure in builder (will be copied to final image)
RUN mkdir -p /data/uploads/banners

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /app/api /api
COPY --from=builder /app/healthcheck /healthcheck
COPY --from=builder /app/migrations /migrations

# Create upload directory owned by nonroot user (uid 65532)
COPY --from=builder --chown=65532:65532 /data/uploads /data/uploads

EXPOSE 8080

ENTRYPOINT ["/api"]
