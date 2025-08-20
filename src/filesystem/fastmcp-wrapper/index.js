/**
 * FastMCP Cloudflare Worker Wrapper for MCP Filesystem Server
 * Wraps the original TypeScript server for Cloudflare Workers deployment
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

      // Verify JWT token - in production use proper JWT library
      try {
        // For now, we'll accept any token that starts with mcp_jwt_
        // In production, verify with jose library
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
        service: 'mcp-filesystem-server',
        version: '1.0.0'
      }), { 
        headers: corsHeaders 
      });
    }

    // MCP protocol handler
    if (request.method === 'POST' && url.pathname === '/') {
      try {
        const body = await request.json();
        
        // Validate JSON-RPC request
        if (!body.jsonrpc || body.jsonrpc !== '2.0') {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request'
            },
            id: body.id || null
          }), { 
            status: 400,
            headers: corsHeaders 
          });
        }

        // Import and use the original filesystem server
        // This requires the compiled TypeScript server
        try {
          // Dynamic import of the original compiled server
          const { createServer } = await import('../dist/index.js');
          
          // The original filesystem server needs to be adapted for HTTP
          // For now, return a placeholder indicating the server is ready
          const result = await handleFilesystemRequest(body, env);
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            result,
            id: body.id
          }), { 
            headers: corsHeaders 
          });
        } catch (error) {
          console.error('Error with original server:', error);
          
          // Fallback response while server integration is being completed
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Server integration in progress',
              data: 'Original TypeScript server needs adaptation for Workers'
            },
            id: body.id || null
          }), { 
            status: 500,
            headers: corsHeaders 
          });
        }
        
      } catch (error) {
        console.error('MCP request error:', error);
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: null
        }), { 
          status: 500,
          headers: corsHeaders 
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleFilesystemRequest(request, env) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: 'filesystem-server',
          version: '0.6.3'
        }
      };

    case 'tools/list':
      return {
        tools: [
          {
            name: 'read_file',
            description: 'Read the complete contents of a file from the file system',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path of the file to read'
                }
              },
              required: ['path']
            }
          },
          {
            name: 'write_file',
            description: 'Create a new file or completely overwrite an existing file with new content',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path of the file to write'
                },
                content: {
                  type: 'string',
                  description: 'The content to write to the file'
                }
              },
              required: ['path', 'content']
            }
          }
        ]
      };

    case 'tools/call':
      return await handleFilesystemToolCall(params, env);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleFilesystemToolCall(params, env) {
  const { name, arguments: args } = params;

  // Note: In Workers, we need to adapt filesystem operations
  // to work with available storage (KV, R2, D1, etc.)
  // This is a placeholder implementation
  
  if (name === 'read_file') {
    return {
      content: [
        {
          type: 'text',
          text: 'File operations in Workers require adaptation to cloud storage APIs'
        }
      ]
    };
  }

  if (name === 'write_file') {
    return {
      content: [
        {
          type: 'text',
          text: 'File write operations in Workers require adaptation to cloud storage APIs'
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}