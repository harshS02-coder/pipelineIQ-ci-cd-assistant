# Deployment Guide

## Overview

This guide covers deploying the LLM DevOps Assistant to various environments.

---

## ✅ Pre-Flight Checklist

- [ ] MongoDB instance (production)
- [ ] Redis instance (production)
- [ ] LLM API Access (OpenAI, Anthropic, or Ollama)
- [ ] API Key for authentication
- [ ] GitHub Webhook Secret (if using GitHub Actions)
- [ ] Domain/IP for webhooks
- [ ] SSL/TLS certificate
- [ ] Database encryption keys

---

## 🐳 Docker Deployment

### Quick Start (All-in-One)

```bash
cd backend
docker-compose up -d
```

Services will start:
- API: http://localhost:3000
- MongoDB: localhost:27017
- Redis: localhost:6379

### Production Docker Compose

Create `.env.production`:

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

MONGODB_URI=mongodb://llm-user:securepassword@mongodb:27017/llm-devops-assistant
MONGODB_USER=llm-user
MONGODB_PASSWORD=securepassword

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=securepass123

LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4-turbo

API_KEY=prod-api-key-very-long-secure-string
GITHUB_WEBHOOK_SECRET=github-webhook-secret

ENABLE_AUTO_FIX=true
ENABLE_SAFE_FIX_ONLY=true

CORS_ORIGIN=https://yourdomain.com
```

```bash
docker-compose --env-file .env.production up -d
```

---

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Docker image pushed to registry

### 1. Create Namespace

```bash
kubectl create namespace devops-assistant
```

### 2. Create Secrets

```bash
kubectl create secret generic llm-api-secret \
  --from-literal=openai-key=sk-xxx \
  --from-literal=api-key=prod-api-key \
  -n devops-assistant

kubectl create secret generic mongodb-secret \
  --from-literal=username=llm-user \
  --from-literal=password=securepass \
  -n devops-assistant
```

### 3. Create ConfigMap

```bash
kubectl create configmap llm-config \
  --from-literal=llm_provider=openai \
  --from-literal=llm_model=gpt-4-turbo \
  --from-literal=enable_auto_fix=true \
  -n devops-assistant
```

### 4. Deploy MongoDB (using Helm)

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install mongodb bitnami/mongodb \
  --namespace devops-assistant \
  --set auth.username=llm-user \
  --set auth.password=securepass \
  --set persistence.enabled=true \
  --set persistence.size=10Gi
```

### 5. Deploy Redis (using Helm)

```bash
helm install redis bitnami/redis \
  --namespace devops-assistant \
  --set auth.password=securepass \
  --set persistence.enabled=true
```

### 6. Create API Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-devops-api
  namespace: devops-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-devops-api
  template:
    metadata:
      labels:
        app: llm-devops-api
    spec:
      containers:
      - name: api
        image: your-registry/llm-devops-api:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          value: "mongodb://llm-user:$(MONGO_PASSWORD)@mongodb.devops-assistant:27017/llm-devops"
        - name: MONGO_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: password
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-api-secret
              key: openai-key
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-api-secret
              key: api-key
        - name: REDIS_HOST
          value: "redis-master.devops-assistant"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis
              key: redis-password
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 20
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: llm-devops-api
  namespace: devops-assistant
spec:
  type: LoadBalancer
  selector:
    app: llm-devops-api
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
```

Deploy:
```bash
kubectl apply -f k8s/deployment.yaml
```

### 7. Setup Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: llm-devops-ingress
  namespace: devops-assistant
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - llm-devops.yourdomain.com
    secretName: tls-secret
  rules:
  - host: llm-devops.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llm-devops-api
            port:
              number: 80
```

---

## ☁️ AWS ECS/Fargate

### 1. Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name llm-devops-api \
  --region us-east-1
```

### 2. Build and Push Image

```bash
docker build -t llm-devops-api:1.0.0 ./backend

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag llm-devops-api:1.0.0 YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/llm-devops-api:1.0.0

docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/llm-devops-api:1.0.0
```

### 3. Create RDS MongoDB (DocumentDB)

```bash
aws docdb create-db-cluster \
  --db-cluster-identifier llm-devops-cluster \
  --engine docdb \
  --master-username admin \
  --master-user-password SecurePassword123!
```

### 4. Create ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id llm-devops-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --region us-east-1
```

### 5. Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name llm-devops

aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

Example `task-definition.json`:

```json
{
  "family": "llm-devops-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/llm-devops-api:1.0.0",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "LLM_PROVIDER",
          "value": "openai"
        }
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:llm-mongodb-uri"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:llm-openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/llm-devops-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

---

## 🔒 Production Security Checklist

- [ ] Enable MongoDB authentication
- [ ] Enable Redis authentication  
- [ ] Use SSL/TLS for all external connections
- [ ] Implement VPC/network isolation
- [ ] Set environment variables securely (use secrets manager)
- [ ] Enable logging and monitoring
- [ ] Regular database backups
- [ ] API rate limiting configured
- [ ] CORS properly restricted
- [ ] Webhook signature validation
- [ ] Regular security updates

---

## 📊 Monitoring & Logging

### CloudWatch (AWS)

```bash
# Create log group
aws logs create-log-group --log-group-name /llm-devops/api
aws logs put-retention-policy --log-group-name /llm-devops/api --retention-in-days 30
```

### Application Metrics

Monitor:
- **API Response Time**: Average request latency
- **Error Rate**: Failed requests / total
- **Queue Depth**: Pending analysis jobs
- **Fix Success Rate**: Successful fixes / total
- **Database Connections**: Active MongoDB connections
- **Redis Memory**: Memory usage percentage

---

## 🔄 Auto-Scaling

### Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-devops-hpa
  namespace: devops-assistant
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-devops-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 🔧 Troubleshooting

### API Won't Start
```bash
# Check logs
docker-compose logs api

# Verify MongoDB connectivity
docker-compose exec api npm test
```

### Slow Analysis
- Check LLM API latency
- Verify MongoDB performance
- Monitor Redis queue depth

### High Memory Usage
- Check for memory leaks in logs
- Verify database connection pool
- Monitor queue job retention

---

## 📞 Support

For deployment issues, check:
- `docker-compose logs`
- Application logs in `/var/log/llm-devops/`
- Database query logs
