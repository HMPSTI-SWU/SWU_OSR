FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/api ./cmd/api

# Pre-create upload directory for the nonroot user
RUN mkdir -p /data/uploads/banners

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /app/api /api
COPY --from=builder /app/migrations /migrations
COPY --from=builder --chown=65532:65532 /data/uploads /data/uploads

EXPOSE 8080

ENTRYPOINT ["/api"]
