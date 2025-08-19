#!/usr/bin/env python3
# FastMCP Wrapper for MCP Time Server
# Proxies requests to the original server without modifying it

import os
import json
import subprocess
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

class MCPProxy:
    def __init__(self):
        self.process = None
        self.lock = threading.Lock()
        
    def start_original_server(self):
        """Start the original MCP server as a subprocess"""
        if self.process is None:
            self.process = subprocess.Popen(
                ['python', '-m', 'mcp_server_time'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0
            )
            print("Original MCP Time server started", flush=True)
    
    def send_to_server(self, request_data):
        """Send request to original server and get response"""
        with self.lock:
            if not self.process:
                self.start_original_server()
            
            # Send request to original server via stdin
            request_str = json.dumps(request_data) + '\n'
            self.process.stdin.write(request_str)
            self.process.stdin.flush()
            
            # Read response from stdout
            response_line = self.process.stdout.readline()
            if response_line:
                return json.loads(response_line)
            return {"error": "No response from server"}

# Initialize proxy
proxy = MCPProxy()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'mcp-time-server',
        'version': '1.0.0'
    })

@app.route('/', methods=['POST', 'OPTIONS'])
@app.route('/mcp', methods=['POST', 'OPTIONS'])
def handle_mcp():
    """Handle MCP protocol requests"""
    if request.method == 'OPTIONS':
        return '', 200
    
    # Check JWT if required
    if os.environ.get('REQUIRE_JWT') == 'true':
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token or not token.startswith('mcp_jwt_'):
            return jsonify({
                'jsonrpc': '2.0',
                'error': {
                    'code': -32001,
                    'message': 'Unauthorized - Invalid or missing JWT token'
                },
                'id': None
            }), 401
    
    try:
        data = request.get_json()
        response = proxy.send_to_server(data)
        return jsonify(response)
    except Exception as e:
        return jsonify({
            'jsonrpc': '2.0',
            'error': {
                'code': -32603,
                'message': f'Internal error: {str(e)}'
            },
            'id': None
        }), 500

if __name__ == '__main__':
    # Start the original server on startup
    proxy.start_original_server()
    
    # Run Flask app
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)