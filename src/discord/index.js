/**
 * FastMCP Wrapper for Discord MCP Server
 * Discord integration for community management and messaging
 * Note: This is a simplified wrapper for cloud environments
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (env.API_KEY || env.SERVICE_KEY) {
      const authHeader = request.headers.get('Authorization');
      const providedKey = authHeader?.replace('Bearer ', '');
      
      const validKeys = [];
      if (env.API_KEY) validKeys.push(env.API_KEY);
      if (env.SERVICE_KEY) validKeys.push(env.SERVICE_KEY);
      
      if (!providedKey || !validKeys.includes(providedKey)) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id: null
        }), { status: 401, headers: corsHeaders });
      }
    }

    if (request.method === 'POST' && url.pathname === '/') {
      try {
        const body = await request.json();
        
        if (!body.jsonrpc || body.jsonrpc !== '2.0') {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: body.id || null
          }), { status: 400, headers: corsHeaders });
        }

        const result = await handleMCPRequest(body, env);
        
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          result,
          id: body.id
        }), { headers: corsHeaders });
        
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error', data: error.message },
          id: null
        }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        service: 'mcp-discord-server',
        version: '1.0.0'
      }), { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleMCPRequest(request, env) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'discord-server', version: '1.0.0' }
      };

    case 'tools/list':
      return {
        tools: [
          {
            name: 'send_message',
            description: 'Send a message to a Discord channel (requires bot permissions and real-time connection).',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: { type: 'string', description: 'Discord channel ID' },
                message: { type: 'string', description: 'Message content to send' }
              },
              required: ['channel_id', 'message']
            }
          },
          {
            name: 'get_channel_info',
            description: 'Get information about a Discord channel via REST API.',
            inputSchema: {
              type: 'object',
              properties: {
                channel_id: { type: 'string', description: 'Discord channel ID' }
              },
              required: ['channel_id']
            }
          },
          {
            name: 'get_guild_info',
            description: 'Get information about a Discord server/guild via REST API.',
            inputSchema: {
              type: 'object',
              properties: {
                guild_id: { type: 'string', description: 'Discord guild/server ID' }
              },
              required: ['guild_id']
            }
          }
        ]
      };

    case 'tools/call':
      return await handleToolCall(params, env);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleToolCall(params, env) {
  const { name, arguments: args } = params;

  const discordToken = env.DISCORD_TOKEN || '';
  
  if (!discordToken) {
    throw new Error('DISCORD_TOKEN is required');
  }

  switch (name) {
    case 'send_message':
      return await sendMessage(args, discordToken);
    case 'get_channel_info':
      return await getChannelInfo(args, discordToken);
    case 'get_guild_info':
      return await getGuildInfo(args, discordToken);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function makeDiscordRequest(endpoint, options = {}, token) {
  const response = await fetch(`https://discord.com/api/v10/${endpoint}`, {
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

async function sendMessage(args, token) {
  try {
    const { channel_id, message } = args;
    
    const data = await makeDiscordRequest(`channels/${channel_id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: message })
    }, token);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message_sent: true,
            message_id: data.id,
            channel_id: data.channel_id,
            content: data.content,
            timestamp: data.timestamp
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error sending message: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

async function getChannelInfo(args, token) {
  try {
    const { channel_id } = args;
    const data = await makeDiscordRequest(`channels/${channel_id}`, {}, token);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            channel: {
              id: data.id,
              name: data.name,
              type: data.type,
              guild_id: data.guild_id,
              position: data.position,
              topic: data.topic,
              nsfw: data.nsfw,
              last_message_id: data.last_message_id,
              bitrate: data.bitrate,
              user_limit: data.user_limit,
              rate_limit_per_user: data.rate_limit_per_user
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting channel info: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

async function getGuildInfo(args, token) {
  try {
    const { guild_id } = args;
    const data = await makeDiscordRequest(`guilds/${guild_id}`, {}, token);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            guild: {
              id: data.id,
              name: data.name,
              icon: data.icon,
              owner_id: data.owner_id,
              permissions: data.permissions,
              region: data.region,
              member_count: data.approximate_member_count,
              presence_count: data.approximate_presence_count,
              features: data.features,
              premium_tier: data.premium_tier,
              premium_subscription_count: data.premium_subscription_count,
              preferred_locale: data.preferred_locale,
              nsfw_level: data.nsfw_level,
              verification_level: data.verification_level
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting guild info: ${error.message}`
        }
      ],
      isError: true
    };
  }
}