# PRISM Backend API Documentation

Base URL: `http://localhost:3000` (configurable via PORT env var)

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

Tokens are obtained via the login endpoint and expire after 8 hours.

---

## 1. Identity Module (`/api/identity`)

### POST /api/identity/provision
Provision a new user (admin operation).

**Auth Required:** No

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (201 Created):**
```json
{
  "message": "User provisioned successfully",
  "user": {
    "id": "uuid",
    "email": "string",
    "role_name": "string"
  }
}
```

**Errors:**
- `400` - Email and password are required
- `409` - A user with this email already exists
- `500` - Internal server error

---

### POST /api/identity/login
Authenticate user and receive JWT token.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "string (JWT)"
}
```

**Errors:**
- `400` - Email and password are required
- `401` - Invalid email or password
- `500` - Internal server error

---

### GET /api/identity/me
Get current authenticated user details.

**Auth Required:** Yes

**Response (200 OK):**
```json
{
  "user": {
    "userId": "uuid",
    "email": "string",
    "role": "string"
  }
}
```

---

## 2. Sites Module (`/api/sites`)

### GET /api/sites/regions
Get all regions.

**Auth Required:** Yes

**Response (200 OK):**
```json
{
  "regions": [
    {
      "id": "uuid",
      "name": "string",
      "status": "string",
      "center_lat": "number",
      "center_lng": "number",
      "boundary_geojson": "object"
    }
  ]
}
```

---

### GET /api/sites/macro
Get macro map data for a region (includes sites with status).

**Auth Required:** Yes

**Query Parameters:**
- `region` (string, required) - Region name

**Response (200 OK):**
```json
{
  "region": {
    "id": "uuid",
    "name": "string",
    "status": "PENDING|CLEAR|string (computed)",
    "center": {
      "lat": "number",
      "lng": "number"
    },
    "boundary": "object (GeoJSON)"
  },
  "sites": [
    {
      "id": "uuid",
      "code": "string",
      "name": "string",
      "address": "string",
      "lat": "number",
      "lng": "number",
      "status": "PENDING|CLEAR|string"
    }
  ]
}
```

**Errors:**
- `400` - Query parameter "region" is required
- `404` - Region not found
- `500` - Internal server error

---

### GET /api/sites/:siteId/assets
Get micro map data (assets) for a specific site.

**Auth Required:** Yes

**URL Parameters:**
- `siteId` (uuid, required)

**Response (200 OK):**
```json
{
  "siteId": "uuid",
  "assets": [
    {
      "id": "uuid",
      "name": "string",
      "category": "string",
      "material": "string",
      "surface": "string",
      "lat": "number",
      "lng": "number",
      "status": "CLEAR|MAINTENANCE PENDING|UNDER_REPAIR|string",
      "imageUrl": "string|null"
    }
  ]
}
```

**Errors:**
- `400` - Site ID parameter is required
- `500` - Internal server error

---

### POST /api/sites/assets/:assetId/thumbnails
Upload/update thumbnail image for an asset. Deletes old image if exists.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data`

**URL Parameters:**
- `assetId` (uuid, required)

**Form Data:**
- `thumbnails` (file, required) - Image file

**Response (200 OK):**
```json
{
  "message": "Thumbnail uploaded successfully!",
  "asset": {
    "id": "uuid",
    "name_identifier": "string",
    "image_url": "/uploads/assets/thumbnails/filename.ext"
  }
}
```

**Errors:**
- `400` - No image file provided
- `404` - Asset not found
- `500` - Internal server error

**Notes:** Old images are automatically deleted from disk.

---

## 3. Assets Module (`/api/assets`)

### GET /api/assets/:assetId/digital-twin
Fetch complete Digital Twin page payload with timeline, active capture, hotspots, and active issues.

**Auth Required:** Yes

**URL Parameters:**
- `assetId` (uuid, required)

**Query Parameters:**
- `captureId` (uuid, optional) - Specific capture to view
- `targetDate` (ISO date, optional) - View capture closest to this date

**Response (200 OK):**
```json
{
  "site": {
    "id": "uuid",
    "code": "string",
    "name": "string",
    "location": "string",
    "latestCapturedAt": "ISO8601 timestamp|null"
  },
  "asset": {
    "id": "uuid",
    "name": "string",
    "category": "string",
    "material": "string",
    "surface": "string",
    "status": "string",
    "thumbnailUrl": "string|null",
    "lat": "number",
    "lng": "number"
  },
  "activeCapture": {
    "id": "uuid",
    "image360Url": "/uploads/assets/360/filename.ext",
    "capturedAt": "ISO8601 timestamp",
    "isLatest": "boolean",
    "hotspots": [
      {
        "id": "uuid",
        "targetAssetId": "uuid",
        "targetAssetName": "string",
        "targetAssetCategory": "string",
        "targetAssetStatus": "string",
        "pitch": "number (-90 to 90)",
        "yaw": "number (-180 to 180)",
        "isAutoGenerated": "boolean"
      }
    ],
    "hotspotValidation": {
      "totalSiteAssets": "number",
      "expectedOtherAssets": "number",
      "linkedHotspotsCount": "number",
      "hasMissingHotspots": "boolean",
      "isWarningIgnored": "boolean",
      "shouldShowWarning": "boolean",
      "message": "string"
    }
  } | null,
  "activeIssue": {
    "ticketId": "uuid",
    "ticketNumber": "string",
    "category": "string",
    "priority": "string",
    "description": "string",
    "status": "string",
    "reportedOn": "ISO8601 timestamp"
  } | null,
  "timeline": [
    {
      "captureId": "uuid",
      "capturedAt": "ISO8601 timestamp",
      "isLatest": "boolean"
    }
  ]
}
```

**Errors:**
- `404` - Asset not found
- `500` - Internal server error

---

### POST /api/assets/:assetId/captures
Upload a 360° panorama image for an asset.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data`

**URL Parameters:**
- `assetId` (uuid, required)

**Form Data:**
- `image360` (file, required) - 360° image file
- `capturedAt` (ISO date, optional) - Capture timestamp

**Response (201 Created):**
```json
{
  "message": "360° capture uploaded successfully!",
  "capture": {
    "id": "uuid",
    "asset_id": "uuid",
    "image_360_url": "/uploads/assets/360/filename.ext",
    "captured_at": "ISO8601 timestamp",
    "uploaded_by": "uuid|null",
    "is_latest": "boolean",
    "ignore_hotspot_warning": "boolean"
  }
}
```

**Errors:**
- `400` - No 360 image file provided
- `404` - Asset not found
- `500` - Internal server error

---

### POST /api/assets/captures/:captureId/hotspots
Manually place or update a hotspot on a 360° image.

**Auth Required:** Yes

**URL Parameters:**
- `captureId` (uuid, required)

**Request Body:**
```json
{
  "targetAssetId": "uuid (required)",
  "pitch": "number (required, -90 to 90)",
  "yaw": "number (required, -180 to 180)"
}
```

**Response (200 OK):**
```json
{
  "message": "Hotspot saved successfully!",
  "hotspot": {
    "id": "uuid",
    "capture_id": "uuid",
    "target_asset_id": "uuid",
    "pitch": "number",
    "yaw": "number",
    "is_auto_generated": "boolean",
    "created_by": "uuid|null",
    "created_at": "ISO8601 timestamp"
  }
}
```

**Errors:**
- `400` - targetAssetId, pitch, and yaw are required
- `400` - Pitch must be a valid angle between -90 and 90
- `400` - Yaw must be a valid angle between -180 and 180
- `400` - An asset capture cannot place a hotspot pointing to itself
- `400` - Target asset must belong to the same playground site
- `404` - Source 360 capture not found
- `404` - Target asset not found
- `500` - Internal server error

---

### DELETE /api/assets/hotspots/:hotspotId
Delete a hotspot.

**Auth Required:** Yes

**URL Parameters:**
- `hotspotId` (uuid, required)

**Response (200 OK):**
```json
{
  "message": "Hotspot removed successfully."
}
```

**Errors:**
- `404` - Hotspot not found
- `500` - Internal server error

---

### PATCH /api/assets/captures/:captureId/ignore-warning
Dismiss or re-enable the "missing hotspots" soft warning on a 360° capture.

**Auth Required:** Yes

**URL Parameters:**
- `captureId` (uuid, required)

**Request Body:**
```json
{
  "ignore": "boolean (optional, defaults to true)"
}
```

**Response (200 OK):**
```json
{
  "message": "Missing hotspot warning permanently dismissed for this 360° capture.|Missing hotspot warning re-enabled for this 360° capture.",
  "capture": {
    "id": "uuid",
    "asset_id": "uuid",
    "image_360_url": "string",
    "captured_at": "ISO8601 timestamp",
    "is_latest": "boolean",
    "ignore_hotspot_warning": "boolean"
  }
}
```

**Errors:**
- `404` - Capture not found
- `500` - Internal server error

---

## 4. Tickets Module (`/api/tickets`)

### POST /api/tickets
Create a new maintenance ticket (Stage 1). Sets asset status to MAINTENANCE PENDING.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data` or `application/json`

**Form Data (optional):**
- `ticketMedia` (file, optional) - Before photo

**Request Body:**
```json
{
  "assetId": "uuid (required)",
  "category": "string (required)",
  "description": "string (required)",
  "priority": "string (optional)",
  "mediaType": "string (optional, default: 'field_photo')"
}
```

**Response (201 Created):**
```json
{
  "message": "Maintenance ticket created! Asset status is now MAINTENANCE PENDING.",
  "ticket": {
    "id": "uuid",
    "ticket_number": "string",
    "asset_id": "uuid",
    "reported_by": "uuid|null",
    "category": "string",
    "priority": "string",
    "status": "OPEN",
    "description": "string",
    "before_media_url": "/uploads/tickets/filename.ext|null",
    "before_media_type": "string|null",
    "assigned_group_id": "uuid|null",
    "assigned_worker_id": "uuid|null",
    "created_at": "ISO8601 timestamp"
  },
  "assetStatusUpdated": "MAINTENANCE PENDING"
}
```

**Errors:**
- `400` - assetId, category, and description are required
- `404` - Target asset not found
- `500` - Internal server error

---

### GET /api/tickets/asset/:assetId
Get all tickets for a specific asset.

**Auth Required:** Yes

**URL Parameters:**
- `assetId` (uuid, required)

**Response (200 OK):**
```json
{
  "count": "number",
  "tickets": [
    {
      "id": "uuid",
      "ticket_number": "string",
      "asset_id": "uuid",
      "reported_by": "uuid|null",
      "category": "string",
      "priority": "string",
      "status": "OPEN|ASSIGNED|IN_PROGRESS|PENDING_VERIFICATION|APPROVED|REJECTED",
      "description": "string",
      "before_media_url": "string|null",
      "before_media_type": "string|null",
      "after_media_url": "string|null",
      "after_media_type": "string|null",
      "assigned_group_id": "uuid|null",
      "assigned_worker_id": "uuid|null",
      "resolution_notes": "string|null",
      "rejection_reason": "string|null",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp"
    }
  ]
}
```

**Errors:**
- `500` - Internal server error

---

### GET /api/tickets/:ticketId/dispatch-options
Get auto-suggested maintenance group and all active contracted groups for a ticket (Stage 2A).

**Auth Required:** Yes

**URL Parameters:**
- `ticketId` (uuid, required)

**Response (200 OK):**
```json
{
  "ticket": {
    "id": "uuid",
    "ticket_number": "string",
    "asset_id": "uuid",
    "organization_id": "uuid",
    "category": "string",
    "priority": "string",
    "status": "string"
  },
  "suggestedGroup": {
    "groupId": "uuid",
    "groupName": "string",
    "specialization": "string",
    "activeWorkersCount": "number",
    "openTicketsCount": "number",
    "loadScore": "number"
  } | null,
  "availableGroups": [
    {
      "groupId": "uuid",
      "groupName": "string",
      "specialization": "string",
      "contractStatus": "ACTIVE",
      "activeWorkersCount": "number",
      "openTicketsCount": "number",
      "loadScore": "number"
    }
  ]
}
```

**Errors:**
- `404` - Ticket not found
- `500` - Internal server error

---

### GET /api/tickets/:ticketId
Get full details of a single ticket (includes media and audit history).

**Auth Required:** Yes

**URL Parameters:**
- `ticketId` (uuid, required)

**Response (200 OK):**
```json
{
  "id": "uuid",
  "ticket_number": "string",
  "asset_id": "uuid",
  "reported_by": "uuid|null",
  "category": "string",
  "priority": "string",
  "status": "string",
  "description": "string",
  "before_media_url": "string|null",
  "before_media_type": "string|null",
  "after_media_url": "string|null",
  "after_media_type": "string|null",
  "assigned_group_id": "uuid|null",
  "assigned_worker_id": "uuid|null",
  "resolution_notes": "string|null",
  "rejection_reason": "string|null",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "asset": {
    "id": "uuid",
    "name": "string",
    "site_id": "uuid"
  },
  "reportedBy": {
    "id": "uuid",
    "email": "string"
  } | null,
  "assignedGroup": {
    "id": "uuid",
    "name": "string"
  } | null,
  "assignedWorker": {
    "id": "uuid",
    "email": "string"
  } | null,
  "history": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "action": "string",
      "performed_by": "uuid|null",
      "notes": "string|null",
      "created_at": "ISO8601 timestamp"
    }
  ]
}
```

**Errors:**
- `404` - Ticket not found
- `500` - Internal server error

---

### POST /api/tickets/:ticketId/assign
Dispatch ticket to maintenance group and auto-assign least-busy worker (Stage 2B).

**Auth Required:** Yes

**URL Parameters:**
- `ticketId` (uuid, required)

**Request Body:**
```json
{
  "groupId": "uuid (optional) - If omitted, auto-selects recommended group"
}
```

**Response (200 OK):**
```json
{
  "message": "Ticket dispatched to selected Maintenance Group and auto-assigned to least-busy technician.|Ticket auto-dispatched to recommended Maintenance Group and least-busy technician.",
  "ticket": {
    "id": "uuid",
    "status": "ASSIGNED",
    "assigned_group_id": "uuid",
    "assigned_worker_id": "uuid",
    "updated_at": "ISO8601 timestamp"
  },
  "group": {
    "id": "uuid",
    "name": "string"
  },
  "worker": {
    "id": "uuid",
    "email": "string"
  }
}
```

**Errors:**
- `400` - No active contracted Maintenance Groups (with registered members) found for this Organization
- `403` - This Maintenance Group does not have an ACTIVE handshake link with the asset owning Organization
- `404` - Ticket not found
- `500` - Internal server error

---

### PATCH /api/tickets/:ticketId/start
Worker accepts and starts repair work (Stage 3). Sets status to IN_PROGRESS.

**Auth Required:** Yes

**URL Parameters:**
- `ticketId` (uuid, required)

**Response (200 OK):**
```json
{
  "message": "Work started on ticket.",
  "ticket": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "updated_at": "ISO8601 timestamp"
  }
}
```

**Errors:**
- `404` - Ticket not found
- `500` - Internal server error

---

### PATCH /api/tickets/:ticketId/resolve
Technician submits repair with resolution notes and optional after photo (Stage 4). Sets status to PENDING_VERIFICATION. Asset remains MAINTENANCE PENDING until approved.

**Auth Required:** Yes

**Content-Type:** `multipart/form-data` or `application/json`

**URL Parameters:**
- `ticketId` (uuid, required)

**Form Data (optional):**
- `ticketMedia` (file, optional) - After photo

**Request Body:**
```json
{
  "resolutionNotes": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "message": "Ticket resolved by technician and submitted for management verification! (Asset remains MAINTENANCE PENDING until approved).",
  "ticket": {
    "id": "uuid",
    "status": "PENDING_VERIFICATION",
    "resolution_notes": "string",
    "after_media_url": "/uploads/tickets/filename.ext|null",
    "updated_at": "ISO8601 timestamp"
  }
}
```

**Errors:**
- `400` - resolutionNotes are required when submitting for verification
- `404` - Ticket not found
- `500` - Internal server error

---

### PATCH /api/tickets/:ticketId/verify
Management approves or rejects ticket (Stage 5). If approved, sets status to APPROVED and asset status to CLEAR. If rejected, returns to IN_PROGRESS.

**Auth Required:** Yes

**URL Parameters:**
- `ticketId` (uuid, required)

**Request Body:**
```json
{
  "approved": "boolean (required, true or false)",
  "rejectionReason": "string (optional, required if approved=false)"
}
```

**Response (200 OK):**
```json
{
  "message": "Ticket APPROVED by management! Maintenance log recorded and Asset status synced to CLEAR.|Ticket REJECTED by management and returned to IN_PROGRESS.",
  "ticket": {
    "id": "uuid",
    "status": "APPROVED|IN_PROGRESS",
    "updated_at": "ISO8601 timestamp"
  }
}
```

**Errors:**
- `400` - approved (boolean true or false) is required
- `404` - Ticket not found
- `500` - Internal server error

---

## Common Headers

**Request Headers:**
```
Authorization: Bearer <jwt_token>  (required for most endpoints)
Content-Type: application/json    (for JSON requests)
Content-Type: multipart/form-data (for file uploads)
```

## Static Files

Uploaded files are served at:
- Thumbnails: `/uploads/assets/thumbnails/<filename>`
- 360° images: `/uploads/assets/360/<filename>`
- Ticket media: `/uploads/tickets/<filename>`

## File Upload Constraints

- Multipart field names:
  - `image360` for 360° panorama uploads
  - `ticketMedia` for ticket before/after photos
  - `thumbnails` for asset thumbnails

## Workflow Notes

### Ticket Lifecycle
1. **CREATE** (POST /api/tickets) → Status: OPEN, Asset: MAINTENANCE PENDING
2. **DISPATCH** (POST /api/tickets/:id/assign) → Status: ASSIGNED (auto-assigns group + worker)
3. **START** (PATCH /api/tickets/:id/start) → Status: IN_PROGRESS
4. **RESOLVE** (PATCH /api/tickets/:id/resolve) → Status: PENDING_VERIFICATION (asset still MAINTENANCE PENDING)
5. **VERIFY** (PATCH /api/tickets/:id/verify) → Status: APPROVED (asset → CLEAR) or REJECTED (back to IN_PROGRESS)

### Digital Twin Hotspots
- Each asset (except maybe alone) expects hotspots linking to other assets on same site
- Hotspots can be manually placed via API or auto-generated
- Warning appears if linked hotspots < expected count and not ignored
