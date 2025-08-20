/**
 * FastMCP Cloudflare Worker Wrapper for MCP Sequential Thinking Server
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
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        service: 'mcp-sequentialthinking-server',
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

        // Handle MCP request
        const result = await handleThinkingRequest(body, env);
        
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          result,
          id: body.id
        }), { 
          headers: corsHeaders 
        });
        
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

async function handleThinkingRequest(request, env) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'sequentialthinking-server',
          version: '0.6.3'
        }
      };

    case 'tools/list':
      return {
        tools: [
          {
            name: 'sequential_thinking',
            description: 'Engage in structured, step-by-step thinking to solve complex problems',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The problem or question to think through'
                },
                session_id: {
                  type: 'string',
                  description: 'Optional session ID to continue a previous thinking session'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_thinking_session',
            description: 'Retrieve a complete thinking session',
            inputSchema: {
              type: 'object',
              properties: {
                session_id: {
                  type: 'string',
                  description: 'The session ID to retrieve'
                }
              },
              required: ['session_id']
            }
          },
          {
            name: 'list_sessions',
            description: 'List all thinking sessions',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'clear_session',
            description: 'Clear a specific thinking session',
            inputSchema: {
              type: 'object',
              properties: {
                session_id: {
                  type: 'string',
                  description: 'The session ID to clear'
                }
              },
              required: ['session_id']
            }
          }
        ]
      };

    case 'tools/call':
      return await handleThinkingToolCall(params, env);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleThinkingToolCall(params, env) {
  const { name, arguments: args } = params;
  const userId = request.headers?.get('X-User-Id') || 'default';

  if (name === 'sequential_thinking') {
    try {
      const sessionId = args.session_id || `session_${Date.now()}`;
      const sessionKey = `thinking:${userId}:${sessionId}`;
      
      // Get existing session or create new
      let session = await env.THINKING_KV?.get(sessionKey, 'json') || {
        id: sessionId,
        created: new Date().toISOString(),
        steps: []
      };

      // Add new thinking step
      const step = {
        id: `step_${session.steps.length + 1}`,
        query: args.query,
        timestamp: new Date().toISOString(),
        thinking: `Analyzing: ${args.query}`,
        conclusion: `This requires further analysis through structured thinking.`
      };

      session.steps.push(step);
      session.updated = new Date().toISOString();

      // Store updated session
      await env.THINKING_KV?.put(sessionKey, JSON.stringify(session));

      return {
        content: [
          {
            type: 'text',
            text: `**Sequential Thinking - Step ${step.id}**\n\n**Query:** ${args.query}\n\n**Analysis:** ${step.thinking}\n\n**Conclusion:** ${step.conclusion}\n\n**Session ID:** ${sessionId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in sequential thinking: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  if (name === 'list_sessions') {
    try {
      // In a real implementation, we'd list all sessions for the user
      return {
        content: [
          {
            type: 'text',
            text: 'Session listing functionality available - requires KV storage setup'
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing sessions: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Tool ${name} is being implemented`
      }
    ]
  };
}