# API Routes

Static: `GET /uploads/*` serves uploaded files. Auth = `requireAuth` (Bearer JWT).

## Identity (`/api/identity`)

| Method & Full Path | Auth / Multer Field | Request Params / Body / Query | Brief Purpose |
|---|---|---|---|
| POST `/api/identity/provision` | None | Body: `email`, `password` | Admin-provision a new user |
| POST `/api/identity/login` | None | Body: `email`, `password` | Log in, returns JWT |
| GET `/api/identity/me` | requireAuth | - | Return current authenticated user |

## Sites (`/api/sites`)

| Method & Full Path | Auth / Multer Field | Request Params / Body / Query | Brief Purpose |
|---|---|---|---|
| GET `/api/sites/regions` | requireAuth | - | List regions |
| GET `/api/sites/macro` | requireAuth | Query: `region` (required) | Macro map data for a region |
| GET `/api/sites/:siteId/assets` | requireAuth | Params: `siteId` | Micro map data (assets) for a site |
| POST `/api/sites/assets/:assetId/thumbnails` | requireAuth + Multer `thumbnails` (required) | Params: `assetId` | Upload/replace asset thumbnail |

## Assets (`/api/assets`)

| Method & Full Path | Auth / Multer Field | Request Params / Body / Query | Brief Purpose |
|---|---|---|---|
| GET `/api/assets/:assetId/digital-twin` | requireAuth | Params: `assetId`; Query: `captureId?`, `targetDate?` | Digital Twin page payload |
| POST `/api/assets/:assetId/captures` | requireAuth + Multer `image360` (required) | Params: `assetId`; Body: `capturedAt?` | Upload 360° capture |
| POST `/api/assets/captures/:captureId/hotspots` | requireAuth | Params: `captureId`; Body: `targetAssetId`, `pitch` (-90..90), `yaw` (-180..180) (all required) | Place/update hotspot on a capture |
| DELETE `/api/assets/hotspots/:hotspotId` | requireAuth | Params: `hotspotId` | Delete hotspot |
| PATCH `/api/assets/captures/:captureId/ignore-warning` | requireAuth | Params: `captureId`; Body: `ignore?` (bool, default true) | Dismiss/re-enable missing-hotspot warning |

## Tickets (`/api/tickets`)

| Method & Full Path | Auth / Multer Field | Request Params / Body / Query | Brief Purpose |
|---|---|---|---|
| POST `/api/tickets` | requireAuth + Multer `ticketMedia` (optional) | Body: `assetId`, `category`, `description` (required); `priority?`, `mediaType?` (default `field_photo`) | Stage 1: report issue (OPEN) |
| GET `/api/tickets/asset/:assetId` | requireAuth | Params: `assetId` | List tickets for an asset |
| GET `/api/tickets/:ticketId/dispatch-options` | requireAuth | Params: `ticketId` | Suggested + contracted maintenance groups |
| GET `/api/tickets/:ticketId` | requireAuth | Params: `ticketId` | Ticket details, media, audit history |
| POST `/api/tickets/:ticketId/assign` | requireAuth | Params: `ticketId`; Body: `groupId?` (omit for full auto-assign) | Stage 2: dispatch to group + least-busy worker |
| PATCH `/api/tickets/:ticketId/start` | requireAuth | Params: `ticketId` | Stage 3: technician starts work (IN_PROGRESS) |
| PATCH `/api/tickets/:ticketId/resolve` | requireAuth + Multer `ticketMedia` (optional, after photo) | Params: `ticketId`; Body: `resolutionNotes` (required) | Stage 4: submit for verification (PENDING_VERIFICATION) |
| PATCH `/api/tickets/:ticketId/verify` | requireAuth | Params: `ticketId`; Body: `approved` (boolean, required), `rejectionReason?` | Stage 5: management approve/reject |
