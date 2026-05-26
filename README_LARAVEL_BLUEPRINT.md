# WaZuri Laravel Rebuild Blueprint

This document explains how the current WaZuri project works and how you can rebuild the same idea yourself using Laravel.

WaZuri is a self-hosted WhatsApp API gateway. It exposes HTTP endpoints for creating WhatsApp sessions, scanning QR codes, sending messages, receiving events, managing webhooks, and controlling infrastructure from a dashboard.

The current project is built with NestJS, React, TypeORM, Docker, Redis, BullMQ, and `whatsapp-web.js`. A Laravel version can use Laravel, Laravel Sanctum or hashed API keys, Eloquent, queues, Redis, WebSockets, Docker, and a Node.js WhatsApp engine bridge.

## 1. Main Idea

The application has four major jobs:

1. Manage WhatsApp sessions.
2. Send and receive WhatsApp messages.
3. Deliver events to users through webhooks and WebSockets.
4. Provide a dashboard for operators to manage sessions, API keys, webhooks, plugins, and infrastructure.

In Laravel, you should think of it as an API-first backend with an admin dashboard.

Recommended Laravel stack:

- Laravel 11 or newer
- MySQL/PostgreSQL for production
- SQLite for local development
- Redis for cache and queues
- Laravel Horizon for queue monitoring
- Laravel Reverb or Soketi for WebSockets
- Laravel Sanctum or custom hashed API keys
- Docker Compose for local and production deployment
- A Node.js sidecar service for `whatsapp-web.js`

## 2. Why Laravel Needs A WhatsApp Engine Sidecar

The current project talks directly to WhatsApp Web using `whatsapp-web.js`, which is a Node.js library. Laravel is PHP, so it should not run this library directly.

Use this architecture instead:

```text
Laravel API
  |
  | HTTP or WebSocket commands
  v
Node.js WhatsApp Engine Service
  |
  | whatsapp-web.js
  v
WhatsApp Web
```

Laravel owns business logic, database records, authentication, dashboards, queues, and webhooks. The Node.js sidecar owns browser automation, QR generation, WhatsApp connection state, and actual message sending.

## 3. Core Features

### Sessions

A session represents one connected WhatsApp account.

Main fields:

- `id`
- `name`
- `status`
- `phone`
- `push_name`
- `config`
- `proxy_url`
- `proxy_type`
- `connected_at`
- `last_active_at`

Common statuses:

- `created`
- `initializing`
- `qr_ready`
- `authenticating`
- `ready`
- `disconnected`
- `failed`

Laravel process:

1. User creates a session from the dashboard or API.
2. Laravel stores the session in the database.
3. User starts the session.
4. Laravel calls the Node engine service.
5. Node starts `whatsapp-web.js`.
6. Node returns QR code events to Laravel.
7. Laravel updates session status and exposes the QR code.
8. After scan, Node emits `ready`.
9. Laravel stores phone, push name, and connected time.

Suggested Laravel routes:

```text
POST   /api/sessions
GET    /api/sessions
GET    /api/sessions/{session}
DELETE /api/sessions/{session}
POST   /api/sessions/{session}/start
POST   /api/sessions/{session}/stop
GET    /api/sessions/{session}/qr
GET    /api/sessions/stats/overview
```

Suggested classes:

- `SessionController`
- `SessionService`
- `WhatsAppEngineClient`
- `Session` Eloquent model

## 4. Messages

Messages are sent through the active WhatsApp session.

Supported message types:

- Text
- Image
- Video
- Audio
- Document
- Location
- Contact
- Sticker
- Reply
- Forward
- Reaction
- Bulk messages

Message process:

1. API receives send request.
2. Laravel validates the request.
3. Laravel checks the API key and session permission.
4. Laravel stores a pending outgoing message.
5. Laravel calls the Node engine service.
6. Node sends the WhatsApp message.
7. Laravel updates message status to `sent` or `failed`.
8. Webhooks and WebSocket events are emitted if needed.

Suggested message fields:

- `id`
- `session_id`
- `wa_message_id`
- `chat_id`
- `from`
- `to`
- `body`
- `type`
- `direction`
- `timestamp`
- `metadata`
- `status`
- `created_at`
- `updated_at`

Suggested Laravel routes:

```text
GET  /api/sessions/{session}/messages
POST /api/sessions/{session}/messages/send-text
POST /api/sessions/{session}/messages/send-image
POST /api/sessions/{session}/messages/send-video
POST /api/sessions/{session}/messages/send-audio
POST /api/sessions/{session}/messages/send-document
POST /api/sessions/{session}/messages/send-location
POST /api/sessions/{session}/messages/send-contact
POST /api/sessions/{session}/messages/send-sticker
POST /api/sessions/{session}/messages/reply
POST /api/sessions/{session}/messages/forward
POST /api/sessions/{session}/messages/react
POST /api/sessions/{session}/messages/delete
POST /api/sessions/{session}/messages/send-bulk
```

## 5. Incoming Messages

Incoming messages come from WhatsApp through the Node engine service.

Process:

1. WhatsApp sends message event to Node.
2. Node normalizes the message payload.
3. Node sends the event to Laravel.
4. Laravel stores the incoming message.
5. Laravel dispatches webhooks.
6. Laravel broadcasts the event to dashboard clients.

Suggested internal route from Node to Laravel:

```text
POST /internal/engine/events
```

Protect this route with an internal shared secret.

## 6. Webhooks

Webhooks let users receive real-time events on their own server.

Webhook fields:

- `id`
- `session_id`
- `url`
- `events`
- `secret`
- `headers`
- `active`
- `retry_count`
- `last_triggered_at`

Common events:

- `message.received`
- `message.sent`
- `message.failed`
- `session.qr`
- `session.ready`
- `session.disconnected`
- `session.status`

Webhook process:

1. Event happens.
2. Laravel finds active webhooks for that session and event.
3. Laravel creates a queued webhook delivery job.
4. Queue worker sends HTTP POST request.
5. Laravel signs payload with HMAC if a secret exists.
6. Job retries on failure.
7. Laravel records delivery status.

Use Laravel queues for webhook delivery. Use Horizon for monitoring.

Suggested routes:

```text
POST   /api/sessions/{session}/webhooks
GET    /api/sessions/{session}/webhooks
GET    /api/sessions/{session}/webhooks/{webhook}
PUT    /api/sessions/{session}/webhooks/{webhook}
DELETE /api/sessions/{session}/webhooks/{webhook}
POST   /api/sessions/{session}/webhooks/{webhook}/test
GET    /api/webhooks
```

## 7. API Key Authentication

The current project uses API keys through the `X-API-Key` header.

Laravel should store only hashed API keys.

API key fields:

- `id`
- `name`
- `key_hash`
- `key_prefix`
- `role`
- `allowed_ips`
- `allowed_sessions`
- `is_active`
- `expires_at`
- `last_used_at`
- `usage_count`

Roles:

- `viewer`
- `operator`
- `admin`

Process:

1. Client sends `X-API-Key`.
2. Laravel hashes the received key.
3. Laravel compares the hash with stored keys.
4. Laravel checks active status.
5. Laravel checks expiration.
6. Laravel checks IP whitelist.
7. Laravel checks session restrictions.
8. Laravel checks role permission.
9. Laravel updates usage count and last used time.

Suggested middleware:

- `ApiKeyAuth`
- `RequireRole`

Suggested routes:

```text
POST   /api/auth/api-keys
GET    /api/auth/api-keys
GET    /api/auth/api-keys/{key}
PUT    /api/auth/api-keys/{key}
DELETE /api/auth/api-keys/{key}
POST   /api/auth/api-keys/{key}/revoke
POST   /api/auth/validate
```

## 8. Audit Logs

Audit logs record important API activity.

Fields:

- `id`
- `action`
- `severity`
- `api_key_id`
- `api_key_name`
- `session_id`
- `session_name`
- `ip_address`
- `method`
- `path`
- `status_code`
- `error_message`
- `created_at`

Process:

1. Request enters Laravel.
2. Middleware captures API key, IP, method, and path.
3. Controller/service performs the action.
4. Middleware or service records audit log.
5. Dashboard displays logs.

Suggested route:

```text
GET /api/audit
```

## 9. Dashboard

The dashboard is the operator interface.

Main pages:

- Login
- Dashboard overview
- Sessions
- Message tester
- Webhooks
- API keys
- Logs
- Infrastructure
- Plugins

Laravel options:

- Build dashboard with Blade and Livewire.
- Or build an Inertia.js dashboard with Vue/React.
- Or keep a separate React/Vite dashboard that calls Laravel APIs.

Recommended if you want fast Laravel development:

- Laravel Breeze
- Inertia
- React or Vue
- Tailwind CSS

Dashboard process:

1. User enters API key or logs in.
2. Dashboard stores token/key in browser storage.
3. Dashboard calls Laravel API.
4. Dashboard subscribes to WebSocket events.
5. Session/message status updates live.

## 10. WebSockets

WebSockets are used for live dashboard updates.

Events to broadcast:

- Session status changed
- QR code ready
- Message received
- Message sent
- Webhook delivery failed

Laravel options:

- Laravel Reverb
- Pusher
- Soketi

Suggested event classes:

- `SessionStatusChanged`
- `QrCodeGenerated`
- `MessageReceived`
- `WebhookDeliveryFailed`

## 11. Queues

Queues are needed for slow or retryable work.

Use queues for:

- Webhook delivery
- Bulk messages
- Message retry
- Storage migration
- Long infrastructure tasks

Recommended setup:

- Redis queue connection
- Laravel Horizon
- Separate workers for webhooks and messages

Example queue names:

```text
webhooks
messages
bulk-messages
maintenance
```

## 12. Bulk Messaging

Bulk messaging sends many messages through one session.

Process:

1. User submits a batch.
2. Laravel stores a message batch record.
3. Laravel creates jobs for each recipient.
4. Worker sends messages one by one.
5. Delay is applied between messages.
6. Progress is updated after each send.
7. Dashboard shows sent, failed, pending, and cancelled counts.

Important: add rate limits and delays. Sending too fast may get the WhatsApp account blocked.

Suggested fields:

- `batch_id`
- `session_id`
- `status`
- `messages`
- `options`
- `progress`
- `results`
- `current_index`
- `started_at`
- `completed_at`

## 13. Contacts, Groups, Labels, Channels, Status, Catalog

These modules are wrappers around WhatsApp engine methods.

General process:

1. Laravel receives API request.
2. Laravel validates session is active.
3. Laravel calls Node engine.
4. Node calls `whatsapp-web.js`.
5. Node returns normalized response.
6. Laravel returns JSON to the client.

Suggested controllers:

- `ContactController`
- `GroupController`
- `LabelController`
- `ChannelController`
- `StatusController`
- `CatalogController`

Example routes:

```text
GET  /api/sessions/{session}/contacts
GET  /api/sessions/{session}/groups
POST /api/sessions/{session}/groups
GET  /api/sessions/{session}/labels
GET  /api/sessions/{session}/channels
GET  /api/sessions/{session}/status
GET  /api/sessions/{session}/catalog
```

## 14. Storage

Storage handles media files.

Supported storage types:

- Local disk
- S3-compatible storage
- MinIO for self-hosted S3

Laravel implementation:

- Use Laravel Filesystem.
- Configure `local`, `s3`, and `minio` disks.
- Store media metadata in the database.
- Store actual binary files in filesystem or S3.

Process:

1. Media arrives as upload, URL, or base64.
2. Laravel validates file type and size.
3. Laravel stores file.
4. Laravel sends file reference to Node engine.
5. Node downloads or reads the media and sends it to WhatsApp.

## 15. Infrastructure Management

The current project lets the dashboard save infrastructure settings and restart services.

Laravel can support:

- Database type/status
- Redis status
- Queue status
- Storage status
- Engine status
- Docker service status

Suggested routes:

```text
GET  /api/infra/status
PUT  /api/infra/config
POST /api/infra/restart
GET  /api/infra/health
```

Be careful with this feature. Restarting services and writing config files from a web dashboard can be risky. Restrict it to admin users only.

## 16. Plugins And Hooks

Hooks let custom code react to events.

Example hooks:

- `session.created`
- `session.starting`
- `session.ready`
- `session.disconnected`
- `message.sending`
- `message.sent`
- `message.failed`
- `message.received`
- `webhook.delivered`
- `webhook.error`

Laravel implementation options:

- Use Laravel events and listeners.
- Store plugin metadata in database.
- Let plugins register listeners.
- Start simple before building dynamic plugin loading.

Recommended first version:

Use Laravel events/listeners only. Add dynamic plugins later.

## 17. Database Tables

Minimum tables:

```text
sessions
messages
message_batches
webhooks
api_keys
audit_logs
webhook_deliveries
settings
plugins
```

Optional tables:

```text
contacts_cache
groups_cache
media_files
failed_jobs
jobs
personal_access_tokens
```

## 18. Suggested Laravel Folder Structure

```text
app/
  Http/
    Controllers/Api/
    Middleware/
    Requests/
  Models/
  Services/
    WhatsAppEngineClient.php
    SessionService.php
    MessageService.php
    WebhookService.php
    ApiKeyService.php
  Jobs/
    DeliverWebhookJob.php
    SendBulkMessageJob.php
  Events/
    SessionStatusChanged.php
    MessageReceived.php
  Listeners/
  Policies/
database/
  migrations/
routes/
  api.php
docker/
node-engine/
```

## 19. Node Engine Service

Create a small Node.js service only for WhatsApp.

Responsibilities:

- Start sessions
- Stop sessions
- Generate QR codes
- Send messages
- Listen for incoming messages
- Emit events back to Laravel

Suggested Node routes:

```text
POST /sessions/{sessionName}/start
POST /sessions/{sessionName}/stop
GET  /sessions/{sessionName}/qr
POST /sessions/{sessionName}/messages/text
POST /sessions/{sessionName}/messages/media
```

Node sends callbacks to Laravel:

```text
POST /internal/engine/events
```

Example event payload:

```json
{
  "type": "message.received",
  "sessionId": "uuid",
  "data": {
    "id": "whatsapp-message-id",
    "from": "254700000000@c.us",
    "body": "Hello",
    "timestamp": 1770000000
  }
}
```

## 20. Build Order

Build the Laravel version in this order:

1. Create Laravel project.
2. Add database migrations for sessions, messages, webhooks, API keys, and audit logs.
3. Build API key authentication middleware.
4. Build session CRUD.
5. Create Node engine sidecar.
6. Connect Laravel to Node with `WhatsAppEngineClient`.
7. Implement start session and QR code flow.
8. Implement send text message.
9. Implement incoming message callback.
10. Implement webhooks with queued delivery.
11. Add dashboard.
12. Add WebSocket updates.
13. Add media messages.
14. Add bulk messaging.
15. Add contacts, groups, labels, status, channels, and catalog.
16. Add infrastructure page.
17. Add plugin/hooks system.
18. Add tests and production Docker setup.

## 21. Laravel Commands You Will Use

```bash
composer create-project laravel/laravel wazuri-laravel
cd wazuri-laravel

php artisan make:model Session -m
php artisan make:model Message -m
php artisan make:model Webhook -m
php artisan make:model ApiKey -m
php artisan make:model AuditLog -m

php artisan make:controller Api/SessionController
php artisan make:controller Api/MessageController
php artisan make:controller Api/WebhookController
php artisan make:controller Api/ApiKeyController
php artisan make:controller Api/InfraController

php artisan make:middleware ApiKeyAuth
php artisan make:job DeliverWebhookJob
php artisan make:event MessageReceived
php artisan make:event SessionStatusChanged

php artisan migrate
php artisan queue:work
```

## 22. Docker Services

Recommended local Docker services:

```text
laravel-app
node-engine
postgres
redis
minio
nginx
```

For development, SQLite is fine. For production, use PostgreSQL.

## 23. Security Checklist

Do these from the beginning:

- Hash API keys.
- Never store raw API keys except when first generated.
- Validate all request data.
- Rate-limit message sending endpoints.
- Restrict infrastructure endpoints to admins.
- Protect internal Laravel-to-Node routes with a shared secret.
- Sign webhooks with HMAC.
- Log important actions.
- Do not expose Docker socket publicly.
- Do not expose dashboard without authentication.
- Keep WhatsApp session files private.

## 24. Testing Checklist

Write tests for:

- API key validation
- Role permissions
- Session creation
- Session start failure
- Message send success
- Message send failure
- Webhook signing
- Webhook retry
- Incoming message callback
- Bulk message progress

Use mocked engine responses so your Laravel tests do not need real WhatsApp.

## 25. First Minimal Version

Your first working Laravel version should only include:

- API key authentication
- Session CRUD
- Start session
- QR code display
- Send text message
- Receive incoming message
- Webhook delivery
- Basic dashboard

After that works, add media, bulk messaging, groups, contacts, infrastructure, and plugins.

## 26. Important Design Advice

Keep Laravel as the source of truth. Store sessions, messages, API keys, webhooks, and logs in Laravel.

Keep Node as a replaceable engine. It should not own business logic. It should only connect to WhatsApp and report events back.

This makes the system easier to test, easier to scale, and easier to replace later if you move from `whatsapp-web.js` to another engine.

