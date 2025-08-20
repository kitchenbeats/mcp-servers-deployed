#!/usr/bin/env python3
"""
FastMCP v2 Proxy Wrapper for MCP Time Server
Uses FastMCP's built-in proxy capabilities to wrap the stdio server
"""

import os
import sys
from fastmcp import FastMCP
from fastmcp.server.proxy import ProxyClient

# Create a wrapper script file for the time server
wrapper_script = "/app/run_time_server.py"
with open(wrapper_script, "w") as f:
    f.write("""#!/usr/bin/env python3
import sys
from mcp_server_time import main
if __name__ == "__main__":
    main()
""")
os.chmod(wrapper_script, 0o755)

# Create a proxy that wraps the original stdio time server
proxy = FastMCP.as_proxy(
    ProxyClient(wrapper_script),
    name="time-server-proxy"
)

# Optional: Add JWT authentication middleware
if os.environ.get('REQUIRE_JWT') == 'true':
    @proxy.middleware
    async def jwt_auth(request, call_next):
        """JWT authentication middleware"""
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token or not token.startswith('mcp_jwt_'):
            return {
                'jsonrpc': '2.0',
                'error': {
                    'code': -32001,
                    'message': 'Unauthorized - Invalid or missing JWT token'
                },
                'id': None
            }
        
        # In production, validate JWT properly here
        return await call_next(request)

if __name__ == "__main__":
    # Get transport from environment
    transport = os.environ.get('MCP_TRANSPORT', 'http')
    port = int(os.environ.get('PORT', 8080))
    
    # Run the proxy server with modern HTTP transport (not deprecated SSE)
    if transport == 'http':
        # For cloud deployment - HTTP/2 ready transport
        proxy.run(transport="http", host="0.0.0.0", port=port, path="/")
    else:
        # Default stdio for local use
        proxy.run(transport="stdio")