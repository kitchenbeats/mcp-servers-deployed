FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install FastMCP v2
RUN pip install fastmcp

# Copy the source code
COPY . .

# Install dependencies for the zen server
RUN pip install -r requirements.txt

# Copy the FastMCP proxy wrapper
COPY fastmcp-wrapper/proxy_server.py /app/

# Expose port for Cloud Run
EXPOSE 8080

# Set environment variables for HTTP transport
ENV PORT=8080
ENV MCP_TRANSPORT=http

# Run the FastMCP proxy which will communicate with the zen server via stdio
CMD ["python", "proxy_server.py"]