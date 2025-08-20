FROM python:3.11-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy project files
COPY . .

# Install dependencies
RUN uv sync --frozen

# Expose port for Cloud Run
EXPOSE 8080

# Set environment variables for HTTP transport
ENV PORT=8080
ENV MCP_TRANSPORT=http

# Run the FastMCP server in SSE mode for Cloud Run
CMD ["uv", "run", "python", "-c", "import os; os.environ.setdefault('PORT', '8080'); from main import start_sse_server; start_sse_server()"] 