# Security & Safety Guidelines

## 🔒 Overview

This document outlines security measures and safety protocols for the LLM DevOps Assistant.

---

## 🛑 Safe Auto-Fix Guarantees

The system **will NOT execute** commands matching dangerous patterns:

### Blocked Operations

| Category | Examples | Risk |
|----------|----------|------|
| **Destructive** | `rm -rf /` | Complete system wipe |
| **Boot/Kernel** | `grub-install`, `reboot` | System failure |
| **Disk** | `dd if=`, `fdisk`, `mkfs` | Data loss |
| **Database** | `DROP DATABASE`, `DELETE FROM` | Data destruction |
| **Permission** | `chmod 000` | System lockout |
| **Network** | `iptables`, `ufw` | Connectivity loss |
| **Registry** | `npm publish`, `docker push` | External exposure |
| **VCS** | `git push` | Source code issues |

### Safety Rules

All auto-fix commands must:
1. ✅ Pass whitelist validation
2. ✅ Have clear success indicators
3. ✅ Be reversible (with backups)
4. ✅ Not require interactive input
5. ✅ Complete within timeout
6. ✅ Not access external systems

---

## 🔑 Authentication & Authorization

### API Key Security

**Generation:**
```bash
# Generate secure API key
openssl rand -hex 32
# Output: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f
```

**Storage:**
- Store in `.env` file (git ignored)
- Or use secrets manager (AWS Secrets Manager, Vault, etc.)
- Never commit to version control

**Rotation:**
- Rotate every 90 days
- Invalidate old keys after rotation

### Bearer Tokens

For token-based auth (future):
- Use JWT (JSON Web Tokens)
- Set expiration time (24 hours recommended)
- Sign with strong secret
- Include scope/permissions

---

## 📋 Log Sanitization

### Automatic Redaction

These patterns are automatically removed from logs:

```javascript
// Email addresses
user@example.com → [REDACTED]

// API Keys
api_key=sk-abc123... → api_key=[REDACTED]

// Passwords
password='secret' → password=[REDACTED]

// Auth Tokens
Bearer eyJhbGc... → [REDACTED]

// Credit Cards
1234-5678-9012-3456 → [REDACTED]

// SSN
123-45-6789 → [REDACTED]
```

### Before Sending to LLM

All logs are:
1. Sanitized for credentials
2. Truncated to max 8000 chars
3. Stripped of system paths (if configured)
4. Logged with request ID for audit trail

---

## 🔐 Database Security

### MongoDB Best Practices

```javascript
// Connection with authentication
mongodb://username:password@host:27017/database?authSource=admin&ssl=true

// Encrypt data at rest (WiredTiger)
// Security:
//   authorization: enabled
//   transitionToAuth: false
```

### Backup & Recovery

```bash
# Backup
mongodump --uri "mongodb://user:pass@host/db" --out ./backups

# Restore
mongorestore --uri "mongodb://user:pass@host/db" ./backups/db

# Schedule automated backups
# Use MongoDB Atlas for managed backup
```

### Access Control

```javascript
// Create database user with minimal permissions
db.createUser({
  user: 'llm-app',
  pwd: 'securepassword',
  roles: [
    { role: 'readWrite', db: 'llm-devops' },
    { role: 'read', db: 'admin' }
  ]
});
```

---

## 🔴 Redis Security

### Configuration

```conf
# /etc/redis/redis.conf
requirepass securepassword123
tls-port 6380
tls-cert-file /path/to/cert.pem
tls-key-file /path/to/key.pem
```

### Connection

```javascript
// Always use password and TLS in production
const redis = new Redis({
  host: 'redis.internal',
  port: 6380,
  password: process.env.REDIS_PASSWORD,
  tls: {
    rejectUnauthorized: false
  }
});
```

---

## 🌐 Network Security

### Firewall Rules

**Ingress (Inbound):**
- Port 3000 (API): Only from known sources
- Port 27017 (MongoDB): Only from app servers
- Port 6379 (Redis): Only from app servers

**Egress (Outbound):**
- Port 443 (HTTPS): For LLM API calls
- Port 80: For webhooks (upgrade to HTTPS)

### VPC/Network Isolation

```yaml
# Example: AWS Security Group
SecurityGroup:
  IngressRules:
    - IpProtocol: tcp
      FromPort: 3000
      ToPort: 3000
      CidrIp: 203.0.113.0/24  # CI/CD servers
    - IpProtocol: tcp
      FromPort: 27017
      ToPort: 27017
      SourceSecurityGroupId: sg-app-server
  EgressRules:
    - IpProtocol: tcp
      FromPort: 443
      ToPort: 443
      CidrIp: 0.0.0.0/0  # HTTPS to LLM APIs
```

---

## 🔗 Webhook Security

### GitHub Actions

**1. Set Webhook Secret:**
```bash
# Settings > Webhooks > Add webhook
Payload URL: https://llm-devops.yourdomain.com/api/v1/analyze/webhook
Secret: $(openssl rand -hex 32)
Events: Workflow runs
```

**2. Signature Validation:**
```javascript
// Automatic validation
const signature = req.headers['x-hub-signature-256'];
const hash = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(req.rawBody)
  .digest('hex');

// Request denied if signatures don't match
if (signature !== hash) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### Jenkins

Webhook security:
- Use HTTPS only
- Implement IP whitelisting
- Include timestamp/nonce in payload
- Validate request origin

---

## 📊 Audit Logging

### What's Tracked

```javascript
AuditLog: {
  action: 'analysis-completed|fix-applied|error|unauthorized-access',
  performedBy: 'api-key|user-id|system',
  resourceId: 'failure-id|analysis-id|fix-id',
  timestamp: '2024-03-27T10:30:00Z',
  ipAddress: '203.0.113.42',
  userAgent: 'curl/7.85.0',
  changes: {},
  status: 'success|failed'
}
```

### Access Monitoring

All access is logged:
- API key usage
- Failed authentication
- Rate limit violations
- Unauthorized access attempts

### Retention

- Keep audit logs for minimum 1 year
- Archive after 90 days
- Secure with encryption

---

## 🔍 Vulnerability Management

### Dependencies

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies securely
npm update
```

### Secrets Detection

```bash
# Scan for exposed secrets
npm install -g truffleHog
trufflehog filesystem . --json | tee secrets-scan.json

# Prevent secrets in commits
npm install -D husky pre-commit
```

### Regular Scanning

- **Weekly**: Dependency vulnerability scans
- **Monthly**: Security testing
- **Quarterly**: Penetration testing
- **Annually**: Security audit

---

## 🛡️ Rate Limiting & DDoS Protection

### Rate Limits

**Configured per API key:**
- 100 requests per 15 minutes
- Configurable via environment variable
- Returns `429 Too Many Requests` when exceeded

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711517400
```

### DDoS Mitigation

Deploy behind:
- **Cloudflare**, Akamai, or AWS CloudFront (edge protection)
- **WAF** (Web Application Firewall)
- **Load Balancer** with rate limiting
- **DDoS protection service**

---

## 🔄 Incident Response

### Potential Attacks

| Attack | Detection | Response |
|--------|-----------|----------|
| **Credential Leak** | Audit logs | Rotate API keys immediately |
| **Injection** | Input validation | Fail safely, log attempt |
| **Unauthorized Access** | Failed auth logs | Block IP, investigate |
| **Data Breach** | Anomalous access | Enable backup restore |

### Response Process

1. **Detect**: Monitor logs and alerts
2. **Isolate**: Revoke compromised credentials
3. **Investigate**: Review audit logs
4. **Remediate**: Apply security patch
5. **Notify**: Alert stakeholders
6. **Document**: Post-incident review

---

## ✅ Compliance

### Data Protection

- **GDPR**: Data subject access, right to deletion
- **CCPA**: Privacy notice, opt-out mechanism
- **SOC 2**: Security controls, audit trail
- **ISO 27001**: Information security management

### Encryption

- **In Transit**: TLS 1.3
- **At Rest**: MongoDB encryption at rest
- **Secrets**: Environment-based, no hardcoding

### Retention

- **Audit Logs**: 1 year
- **Analysis Results**: 6 months
- **Pipeline Failures**: 3 months
- **User Data**: Per GDPR request

---

## 🔧 Security Configuration

### Environment Variables (Production)

```bash
# Generate secure values
OPENAI_API_KEY=sk-$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 32)
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
MONGODB_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
```

### SSL/TLS Certificates

```bash
# Generate self-signed (development)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Use Let's Encrypt (production)
certbot certonly --standalone -d llm-devops.yourdomain.com
```

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)

---

## 👥 Report Security Issues

Please report security vulnerabilities responsibly:

1. **Do NOT** create public GitHub issues
2. **Email**: security@yourdomain.com
3. **Include**: Description, reproduction steps, impact
4. **Wait**: For response before public disclosure

---

<div align="center">

**Security is Everyone's Responsibility**

Keep dependencies updated, rotate secrets, monitor logs, and stay vigilant.

</div>
