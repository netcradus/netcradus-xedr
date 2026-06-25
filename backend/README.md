# SentryXDR Backend

SentryXDR is a unified Endpoint Detection and Response (EDR), SIEM and XDR platform.

---

## Features

### Authentication

- Signup
- Login
- JWT Authentication
- Protected Routes

### Role-Based Access Control

- SuperAdmin
- Admin
- Analyst
- Viewer

### Multi-Tenant Architecture

- Tenant Isolation
- API Keys

### Agent Management

- Endpoint Registration
- Agent Tokens

### Telemetry

#### Process Monitoring

- PID
- Parent PID
- Process Name
- Command Line
- Executable Path
- Username
- SHA256 Hash

---

## Tech Stack

### Backend

- FastAPI
- PostgreSQL
- SQLAlchemy
- JWT
- OAuth2

### Future Components

- Redis
- Celery
- WebSockets
- Docker

---

## Installation

### Clone Repository

```bash
git clone https://github.com/yourrepo/SentryXDR.git
```

### Create Virtual Environment

```bash
python -m venv venv
```

### Activate

Windows:

```bash
venv\Scripts\activate
```

Linux:

```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Start Backend

Apply database migrations first:

```bash
alembic upgrade head
```

```bash
uvicorn main:app --reload
```

Swagger:

```
http://127.0.0.1:8000/docs
```

---

## API Modules

### Authentication

```
POST /auth/signup
POST /auth/login
```

### Users

```
GET /users/me
```

### Admin

```
GET /admin/dashboard
```

### Agents

```
POST /agents/register
```

### Telemetry

```
POST /telemetry/processes
```

---

## Database Tables

### users

Stores user information.

### roles

Stores RBAC roles.

### tenants

Stores companies and API keys.

### agents

Stores endpoint information.

### process_telemetry

Stores process events.

---

## Roadmap

### Module 1

Authentication

### Module 2

RBAC

### Module 3

Multi-Tenant Architecture

### Module 4

Agent Registration

### Module 5

Telemetry Collection

### Module 6

Detection Engine

### Module 7

Alert Engine

### Module 8

SOAR

### Module 9

Website Log Monitoring

### Module 10

Threat Intelligence

### Module 11

Frontend Dashboard

### Module 12

AI Assistant
