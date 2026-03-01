# User Setup Guide

This guide helps you create a dedicated user for running the Email Loop Agent on Ubuntu servers.

## Why Use a Dedicated User?

Running the agent under a dedicated non-root user with sudo privileges is a security best practice:
- Limits potential damage from security vulnerabilities
- Provides better process isolation
- Follows the principle of least privilege
- Makes it easier to manage permissions and logs

## Quick Start (One Command)

If you're currently logged in as root and want to quickly set up a new user:

```bash
curl -fsSL https://raw.githubusercontent.com/dongchenxie/agent/refs/heads/master/setup-user.sh | sudo bash
```

Or if you already have the agent folder:

```bash
cd agent
sudo bash setup-user.sh
```

## What This Script Does

1. **Creates a new user** with a home directory
2. **Adds the user to sudo group** for administrative tasks
3. **Sets up the agent directory** at `/home/username/agent`
4. **Copies agent files** to the new user's directory
5. **Creates a helper command** to easily switch to the user
6. **Optionally switches** to the new user immediately

## Step-by-Step Instructions

### 1. Download or Navigate to Agent Folder

If you don't have the agent folder yet:
```bash
git clone https://github.com/dongchenxie/agent.git
cd agent
```

### 2. Run the Setup Script as Root

```bash
sudo bash setup-user.sh
```

### 3. Follow the Prompts

The script will ask you:

**Username:**
```
Enter username to create (default: agent):
```
- Press Enter to use default name "agent"
- Or type a custom username (e.g., "emailagent", "worker", etc.)

**Password:**
```
Please set a password for user 'agent':
```
- Enter a strong password
- You'll need to type it twice for confirmation

**Switch Now:**
```
Do you want to switch to user 'agent' now? (y/n):
```
- Type `y` to switch immediately
- Type `n` to stay as root

### 4. Switch to the New User

If you didn't switch immediately, you can switch later using:

```bash
su - agent
```

Or use the helper command:
```bash
switch-to-agent
```

### 5. Install the Agent

Once switched to the new user:

```bash
cd ~/agent
bash install.sh
```

## Manual User Creation (Alternative Method)

If you prefer to create the user manually:

```bash
# Create user with home directory
sudo useradd -m -s /bin/bash agent

# Set password
sudo passwd agent

# Add to sudo group
sudo usermod -aG sudo agent

# Create agent directory
sudo mkdir -p /home/agent/agent

# Copy agent files (if you have them)
sudo cp -r /path/to/agent/* /home/agent/agent/

# Set ownership
sudo chown -R agent:agent /home/agent/agent

# Switch to user
su - agent
```

## Useful Commands

### Switch Between Users

```bash
# Switch to agent user
su - agent

# Switch back to root (from agent user)
exit
# or
su - root
```

### Check Current User

```bash
whoami
```

### Check User's Groups

```bash
groups agent
```

### Check Sudo Access

```bash
sudo -l
```

## Troubleshooting

### "User already exists" Error

If the user already exists, the script will ask if you want to continue. Choose:
- `y` - Continue and switch to existing user
- `n` - Exit the script

### Permission Denied

Make sure you're running the script with sudo:
```bash
sudo bash setup-user.sh
```

### Can't Switch to User

If `su - agent` doesn't work, check:
1. User exists: `id agent`
2. User has a shell: `grep agent /etc/passwd`
3. You have permission to switch users (are you root or have sudo?)

### Forgot Password

Reset the password as root:
```bash
sudo passwd agent
```

## Security Best Practices

1. **Use a strong password** - Mix of letters, numbers, and symbols
2. **Don't share the password** - Each server should have unique credentials
3. **Use SSH keys** - Set up SSH key authentication instead of passwords
4. **Limit sudo access** - Only use sudo when necessary
5. **Regular updates** - Keep the system and agent updated

## SSH Key Setup (Recommended)

To enable SSH key authentication for the new user:

```bash
# On your local machine, generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id agent@your-server-ip

# Now you can SSH without password
ssh agent@your-server-ip
```

## Next Steps

After setting up the user and installing the agent:

1. Configure the agent with your API credentials
2. Start the agent service
3. Monitor logs to ensure it's running correctly
4. Set up auto-updates (see AUTOUPDATE.md)

## Support

If you encounter issues:
- Check the agent logs: `~/agent/logs/`
- Review the installation guide: `INSTALL.md`
- Check auto-update guide: `AUTOUPDATE.md`

## Example Session

```bash
# As root
root@server:~# cd agent
root@server:~/agent# sudo bash setup-user.sh

# Script prompts
Enter username to create (default: agent): [press Enter]
Please set a password for user 'agent': [enter password]
Do you want to switch to user 'agent' now? (y/n): y

# Now as agent user
agent@server:~$ cd ~/agent
agent@server:~/agent$ bash install.sh

# Agent installs and starts
✓ Agent installed successfully
✓ Agent is running
```

## Files Created

The setup script creates:
- User account: `/home/agent/`
- Agent directory: `/home/agent/agent/`
- Helper script: `/usr/local/bin/switch-to-agent`

## Cleanup

To remove the user and all files:

```bash
# As root
sudo userdel -r agent
sudo rm /usr/local/bin/switch-to-agent
```

**Warning:** This will delete all files in the user's home directory!
