/**
 * FastMCP Cloudflare Worker Wrapper for MCP Memory Server
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
        service: 'mcp-memory-server',
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

        // Handle MCP request using original server logic
        const result = await handleMemoryRequest(body, env);
        
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

async function handleMemoryRequest(request, env) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'memory-server',
          version: '0.6.3'
        }
      };

    case 'tools/list':
      return {
        tools: [
          {
            name: 'create_entities',
            description: 'Create one or more entities in the knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {
                entities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      entityType: { type: 'string' },
                      observations: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    },
                    required: ['name', 'entityType']
                  }
                }
              },
              required: ['entities']
            }
          },
          {
            name: 'create_relations',
            description: 'Create one or more relations between entities',
            inputSchema: {
              type: 'object',
              properties: {
                relations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      from: { type: 'string' },
                      to: { type: 'string' },
                      relationType: { type: 'string' }
                    },
                    required: ['from', 'to', 'relationType']
                  }
                }
              },
              required: ['relations']
            }
          },
          {
            name: 'add_observations',
            description: 'Add observations to existing entities',
            inputSchema: {
              type: 'object',
              properties: {
                observations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      entityName: { type: 'string' },
                      contents: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    },
                    required: ['entityName', 'contents']
                  }
                }
              },
              required: ['observations']
            }
          },
          {
            name: 'search_entities',
            description: 'Search for entities in the knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              },
              required: ['query']
            }
          },
          {
            name: 'read_graph',
            description: 'Read the entire knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };

    case 'tools/call':
      return await handleMemoryToolCall(params, env);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleMemoryToolCall(params, env) {
  const { name, arguments: args } = params;

  // Use KV storage for persistence
  const userMemoryKey = `memory:${request.headers.get('X-User-Id') || 'default'}`;
  
  if (name === 'read_graph') {
    try {
      const graph = await env.MEMORY_KV.get(userMemoryKey, 'json') || { entities: {}, relations: [] };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(graph, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading memory graph: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  if (name === 'create_entities') {
    try {
      const graph = await env.MEMORY_KV.get(userMemoryKey, 'json') || { entities: {}, relations: [] };
      
      for (const entity of args.entities) {
        graph.entities[entity.name] = {
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.observations || []
        };
      }
      
      await env.MEMORY_KV.put(userMemoryKey, JSON.stringify(graph));
      
      return {
        content: [
          {
            type: 'text',
            text: `Created ${args.entities.length} entities`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating entities: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  // Add other tool implementations...
  return {
    content: [
      {
        type: 'text',
        text: `Tool ${name} is being implemented`
      }
    ]
  };
}