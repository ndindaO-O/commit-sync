const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Verify GitHub webhook signature
function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

// Format commit message for Discord
function formatCommitEmbed(commit, repository) {
  const commitUrl = commit.url;
  const shortSha = commit.id.substring(0, 7);
  const authorName = commit.author.name;
  const authorUsername = commit.author.username;
  const message = commit.message.split('\n')[0];
  const timestamp = commit.timestamp;

  return {
    color: 0x7289DA,
    author: {
      name: authorName,
      icon_url: authorUsername ? `https://github.com/${authorUsername}.png` : undefined
    },
    title: `[${repository.name}:${commit.branch || 'unknown'}]`,
    description: `[\`${shortSha}\`](${commitUrl}) ${message}`,
    timestamp: timestamp,
    footer: {
      text: repository.full_name
    }
  };
}

// Format PR embed for Discord
function formatPullRequestEmbed(payload) {
  const pr = payload.pull_request;
  const action = payload.action;

  // Set color based on action/state
  let color = 0x2cbe4e; // Green (Open/Sync)
  if (action === 'closed') {
    color = pr.merged ? 0x6f42c1 : 0xd73a49; // Purple if merged, Red if closed without merge
  }

  return {
    color: color,
    author: {
      name: pr.user.login,
      icon_url: pr.user.avatar_url
    },
    title: `[PR: ${payload.repository.name}] ${pr.title} (#${pr.number})`,
    description: `**Action:** ${action}\n[View Pull Request](${pr.html_url})\n\n${pr.body ? pr.body.substring(0, 200) + (pr.body.length > 200 ? '...' : '') : ''}`,
    fields: [
      {
        name: 'Source (Fork)',
        value: pr.head.label, // e.g., "user:branch"
        inline: true
      },
      {
        name: 'Target',
        value: pr.base.label, // e.g., "owner:main"
        inline: true
      }
    ],
    timestamp: pr.updated_at || new Date().toISOString(),
    footer: {
      text: payload.repository.full_name
    }
  };
}

// Handle push events
app.post('/webhook/github', verifyGitHubSignature, async (req, res) => {
  const event = req.headers['x-github-event'];

  const payload = req.body;

  // Handle Pull Request events (tracking changes from forks)
  if (event === 'pull_request') {
    const action = payload.action;

    // Create embed
    const embed = formatPullRequestEmbed(payload);

    const discordMessage = {
      content: `🔄 Pull Request Update in **${payload.repository.full_name}**`,
      embeds: [embed]
    };

    try {
      await axios.post(DISCORD_WEBHOOK_URL, discordMessage);
      return res.status(200).send('PR event processed successfully');
    } catch (error) {
      console.error('Error sending to Discord:', error.response?.data || error.message);
      return res.status(500).send('Error processing PR webhook');
    }
  }

  // Only handle push events if not PR
  if (event !== 'push') {
    return res.status(200).send('Event ignored');
  }


  const repository = payload.repository;
  const commits = payload.commits;
  const pusher = payload.pusher.name;
  const ref = payload.ref;
  const branch = ref.split('/').pop();

  // Skip if no commits
  if (!commits || commits.length === 0) {
    return res.status(200).send('No commits to display');
  }

  try {
    // Add branch info to commits
    const commitsWithBranch = commits.map(commit => ({
      ...commit,
      branch: branch
    }));

    // Create embeds for each commit (limit to 10 to avoid Discord rate limits)
    const embeds = commitsWithBranch.slice(0, 10).map(commit =>
      formatCommitEmbed(commit, repository)
    );

    // Prepare Discord message
    const discordMessage = {
      content: `**${pusher}** pushed ${commits.length} commit${commits.length > 1 ? 's' : ''} to **${repository.full_name}:${branch}**`,
      embeds: embeds
    };

    // Send to Discord
    await axios.post(DISCORD_WEBHOOK_URL, discordMessage);

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error sending to Discord:', error.response?.data || error.message);
    res.status(500).send('Error processing webhook');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  console.log(`Health check at ${timestamp} - Uptime: ${Math.floor(uptime)}s`);

  res.status(200).json({
    status: 'ok',
    timestamp: timestamp,
    uptime: uptime
  });
});

app.listen(PORT, () => {
  console.log(`Bot is up and running on port ${PORT}...`);
});