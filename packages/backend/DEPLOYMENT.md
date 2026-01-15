# Deployment Guide

## Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY packages/backend/package*.json ./
RUN npm ci --production

COPY packages/backend/dist ./dist
COPY packages/backend/data ./data

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t password-manager-backend .
docker run -p 3001:3001 \
  -e PORT=3001 \
  -e DB_PATH=/app/data/vault.db \
  -v vault-data:/app/data \
  password-manager-backend
```

## Railway.app Deployment

1. Connect GitHub repository
2. Set environment variables:
   - `PORT` → Auto-assigned
   - `DB_PATH` → `/data/vault.db`
   - `NODE_ENV` → `production`

3. Railway automatically runs `npm run build && npm start`

## Vercel Deployment (with External Database)

Vercel doesn't support persistent SQLite. Use PostgreSQL instead:

1. Set up PostgreSQL (Vercel Postgres, Railway, Supabase)
2. Update connection string in environment
3. Deploy as serverless function

## Self-Hosted (VPS)

```bash
# SSH into server
ssh user@server.com

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone https://github.com/user/password-manager.git
cd password-manager/packages/backend

# Install and build
npm install
npm run build

# Create systemd service
sudo cat > /etc/systemd/system/pm-backend.service << EOF
[Unit]
Description=Password Manager Backend
After=network.target

[Service]
Type=simple
User=pm
WorkingDirectory=/home/pm/password-manager/packages/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="DB_PATH=/var/lib/pm/vault.db"

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl enable pm-backend
sudo systemctl start pm-backend
```

## SSL/TLS Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d api.yourapp.com

# Configure nginx as reverse proxy
sudo cat > /etc/nginx/sites-available/pm-backend << EOF
server {
  listen 80;
  server_name api.yourapp.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.yourapp.com;

  ssl_certificate /etc/letsencrypt/live/api.yourapp.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.yourapp.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
EOF

# Enable and restart
sudo ln -s /etc/nginx/sites-available/pm-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Database Backup Strategy

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/pm-vault"
DB_PATH="/var/lib/pm/vault.db"

mkdir -p $BACKUP_DIR

# Create backup
cp $DB_PATH $BACKUP_DIR/vault_$DATE.db

# Encrypt backup
gpg --symmetric --cipher-algo AES256 $BACKUP_DIR/vault_$DATE.db

# Upload to cloud
aws s3 cp $BACKUP_DIR/vault_$DATE.db.gpg s3://backups/

# Clean old local backups
find $BACKUP_DIR -name "*.db.gpg" -mtime +7 -delete
```

Run via cron:
```bash
0 2 * * * /home/pm/backup.sh
```

## Monitoring & Logging

### PM2 Process Manager
```bash
npm install -g pm2

pm2 start dist/index.js --name "pm-backend"
pm2 logs pm-backend
pm2 startup
pm2 save
```

### Health Checks
```bash
# Monitor endpoint
curl http://localhost:3001/health

# Automated monitoring
watch -n 60 'curl -s http://localhost:3001/health | jq .'
```

### Error Tracking
Integrate with Sentry:
```typescript
import Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.errorHandler());
```

## Security Checklist

- [ ] HTTPS/TLS enabled (no HTTP in production)
- [ ] Database encrypted at rest
- [ ] Regular backups, encrypted off-site
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured for frontend domain only
- [ ] Request validation and sanitization
- [ ] Error messages don't leak sensitive info
- [ ] Session tokens over HTTPS only
- [ ] Database passwords in environment variables
- [ ] Nonce garbage collection implemented
- [ ] Audit logging (without sensitive data)
- [ ] Firewall rules restrict access
- [ ] Regular dependency updates
- [ ] Security headers (HSTS, CSP, X-Frame-Options)
