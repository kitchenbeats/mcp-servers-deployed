# Multi-stage build for Go MCP server with FastMCP v2 proxy
FROM golang:1.21-alpine AS go-builder

WORKDIR /src

# Copy Go source
COPY . .

# Build the Go MCP server
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o slack-mcp-server ./cmd/slack-mcp-server

# Runtime stage with Python and FastMCP
FROM python:3.11-slim

WORKDIR /app

# Install FastMCP v2
RUN pip install fastmcp

# Copy the built Go binary
COPY --from=go-builder /src/slack-mcp-server /app/

# Copy the FastMCP proxy wrapper
COPY fastmcp-wrapper/proxy_server.py /app/

# Expose port for Cloud Run
EXPOSE 8080

# Set environment variables for HTTP transport
ENV PORT=8080
ENV MCP_TRANSPORT=http

# Run the FastMCP proxy which will communicate with the Go server via stdio
CMD ["python", "proxy_server.py"]