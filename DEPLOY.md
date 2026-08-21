# IndieStack Deployment Guide for pod21

## Step 1: Upload the code to the server

On your local machine (PowerShell):

```powershell
scp -r "C:\Users\gopik\indiestack" student@10.1.77.10:~/indiestack
```

Enter your SSH password when prompted.

## Step 2: Connect to the server and deploy

```bash
ssh student@10.1.77.10
```

Once connected:

```bash
# Install tmux (if not already installed)
sudo apt update && sudo apt install -y tmux

# Start a tmux session
tmux new -s indiestack

# Navigate to the project
cd ~/indiestack

# Run the deployment script
chmod +x deploy.sh
./deploy.sh
```

## Step 3: Detach and close

Once the deployment script completes:

1. Press `Ctrl + B`, release, then press `D` to detach from tmux
2. Type `exit` to disconnect from SSH

Your site will now run 24/7 on the pod21 server, even when your computer is off.

## To check on it later

```bash
ssh student@10.1.77.10
tmux attach -t indiestack
```

## To update the site with new changes

```bash
# Upload the updated code
scp -r "C:\Users\gopik\indiestack" student@10.1.77.10:~/indiestack

# SSH in and redeploy
ssh student@10.1.77.10
tmux attach -t indiestack
cd ~/indiestack
docker compose down
docker compose up -d --build
```

## Important notes

- The `013_seed_data.sql` file contains all the content (blogs, publications, lists, users) so a fresh database will have everything
- The deployment script handles building and starting all containers
- The Cloudflare tunnel token is in `.env` — make sure it's set correctly on the server
- The site will be accessible at https://tech.namahos.com
