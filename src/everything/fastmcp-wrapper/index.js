/**
 * FastMCP Wrapper for MCP Everything Server
 * This is a thin proxy layer that runs the original TypeScript server
 * WITHOUT modifying or reimplementing any functionality
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers for browser compatibility
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // JWT Authentication
    if (env.JWT_SECRET) {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token || !token.startsWith('mcp_jwt_')) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized - Invalid or missing JWT token'
          },
          id: null
        }), { 
          status: 401,
          headers: corsHeaders 
        });
      }

      // Verify JWT token
      try {
        const jwt = token.replace('mcp_jwt_', '');
        // In production, properly verify the JWT with jose library
        // For now, we'll pass through to the original server
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Invalid JWT token'
          },
          id: null
        }), { 
          status: 401,
          headers: corsHeaders 
        });
      }
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        service: 'mcp-everything-server',
        version: '1.0.0'
      }), { 
        headers: corsHeaders 
      });
    }

    // Import and run the original server
    // The original TypeScript server handles MCP protocol
    try {
      // Dynamic import of the original compiled server
      const { handleRequest } = await import('../dist/index.js');
      
      // Pass the request to the original server
      const response = await handleRequest(request, env);
      
      // Add CORS headers to the response
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      console.error('Error proxying to original server:', error);
      
      // Fallback: If the server doesn't have handleRequest, 
      // we need to properly set up the build process
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: 'Original server integration pending proper build setup'
        },
        id: null
      }), { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};