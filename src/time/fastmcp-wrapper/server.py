#!/usr/bin/env python3
# FastMCP Wrapper for MCP Time Server
# Proxies requests to the original server without modifying it

import os
import json
import asyncio
import subprocess
from aiohttp import web
import sys

class MCPProxy:
    def __init__(self):
        self.process = None
        
    async def start_original_server(self):
        """Start the original MCP server as a subprocess"""
        self.process = await asyncio.create_subprocess_exec(
            sys.executable, '-m', 'mcp_server_time',
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        print("Original MCP Time server started", file=sys.stderr)
        
    async def send_to_server(self, request_data):
        """Send request to original server and get response"""
        if not self.process:
            await self.start_original_server()
            
        # Send request to original server
        request_str = json.dumps(request_data) + '\n'
        self.process.stdin.write(request_str.encode())
        await self.process.stdin.drain()
        
        # Read response
        response_line = await self.process.stdout.readline()
        if response_line:
            return json.loads(response_line.decode())
        return {"error": "No response from server"}

proxy = MCPProxy()

async def handle_mcp(request):
    """Handle MCP protocol requests"""
    # Check JWT if required
    if os.environ.get('REQUIRE_JWT') == 'true':
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token or not token.startswith('mcp_jwt_'):
            return web.json_response({
                'jsonrpc': '2.0',
                'error': {
                    'code': -32001,
                    'message': 'Unauthorized - Invalid or missing JWT token'
                },
                'id': None
            }, status=401)
    
    try:
        data = await request.json()
        response = await proxy.send_to_server(data)
        return web.json_response(response)
    except Exception as e:
        return web.json_response({
            'jsonrpc': '2.0',
            'error': {
                'code': -32603,
                'message': f'Internal error: {str(e)}'
            },
            'id': None
        }, status=500)

async def health_check(request):
    """Health check endpoint"""
    return web.json_response({
        'status': 'ok',
        'service': 'mcp-time-server',
        'version': '1.0.0'
    })

async def init_app():
    """Initialize the web application"""
    app = web.Application()
    
    # Add CORS middleware
    async def cors_middleware(app, handler):
        async def middleware_handler(request):
            if request.method == 'OPTIONS':
                response = web.Response(status=200)
            else:
                response = await handler(request)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            return response
        return middleware_handler
    
    app.middlewares.append(cors_middleware)
    
    # Routes
    app.router.add_post('/', handle_mcp)
    app.router.add_post('/mcp', handle_mcp)
    app.router.add_get('/health', health_check)
    
    # Start the original server
    await proxy.start_original_server()
    
    return app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app = asyncio.run(init_app())
    web.run_app(app, host='0.0.0.0', port=port)