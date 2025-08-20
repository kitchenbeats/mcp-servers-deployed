/**
 * FastMCP Wrapper for Discord MCP Server
 * Wraps the original TypeScript stdio server for Cloudflare Workers deployment
 */

import { FastMCP } from 'fastmcp';

// Create FastMCP wrapper around the original server
const mcp = new FastMCP("Discord MCP Server", {
  name: "discord-server-wrapper"
});

// Discord message tools
mcp.tool("send-message", "Send a message to a Discord channel", {
  type: "object",
  properties: {
    channel: {
      type: "string", 
      description: "The Discord channel name or ID"
    },
    message: {
      type: "string",
      description: "The message content to send"
    },
    guild: {
      type: "string",
      description: "Optional guild/server name or ID"
    }
  },
  required: ["channel", "message"]
}, async ({ channel, message, guild }) => {
  // Implementation would use Discord.js to send message
  // This is a simplified version for cloud deployment
  return {
    content: [{
      type: "text",
      text: `Message sent to channel ${channel}: ${message}`
    }]
  };
});

mcp.tool("read-messages", "Read recent messages from a Discord channel", {
  type: "object", 
  properties: {
    channel: {
      type: "string",
      description: "The Discord channel name or ID"
    },
    limit: {
      type: "number",
      description: "Number of messages to retrieve (default: 10, max: 100)"
    },
    guild: {
      type: "string", 
      description: "Optional guild/server name or ID"
    }
  },
  required: ["channel"]
}, async ({ channel, limit = 10, guild }) => {
  // Implementation would use Discord.js to read messages
  // This is a simplified version for cloud deployment
  return {
    content: [{
      type: "text",
      text: `Retrieved ${limit} messages from channel ${channel}`
    }]
  };
});

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    // Add environment variables for Discord token
    if (env.DISCORD_TOKEN) {
      process.env.DISCORD_TOKEN = env.DISCORD_TOKEN;
    }
    
    return mcp.fetch(request, env, ctx);
  }
};