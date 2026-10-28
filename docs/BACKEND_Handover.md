```python
import os
import pandas as pd

files = os.listdir('.')
print("Files in workspace:", files)

for f in ['tickets.routes.js', 'tickets.controller.js', 'tickets.service.js', 'tickets.model.js']:
    if os.path.exists(f):
        print(f"\n==================== {f} ====================")
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            print(fp.read())


```

```text
Files in workspace: ['input_file_8.png', 'input_file_7.png', 'input_file_6.png', 'input_file_5.png', 'input_file_4.png', 'input_file_3.png', 'input_file_2.png', 'input_file_1.png', 'input_file_0.png']


```

# BACKEND_HANDOVER.md

## 1. Executive Summary

### Source of Truth & Inspection Scope Notice

* **Directly Verified Context**: This handover is compiled from the active conversation history, implemented frontend code (`LoginPage.tsx`, `AppleGlassCard.tsx`, `CyberGridBackground.tsx`, `SpinningGlobe.tsx`, `ManagementDashboard.tsx`), UI wireframes (`image_d28a6a.jpg`), and confirmed architectural discussions.


* **Uninspected Repository Files (Requires Verification in New Chat)**: The local filesystem at `C:\Users\danis\Documents\PRISM\` is not directly mounted in the current environment, and earlier backend artifacts (`Database_Schema_PRISM.xlsx`, `data-1793095463950.csv`, `tickets.routes.js`, `tickets.controller.js`, `tickets.service.js`, `tickets.model.js`) are no longer mounted in the container workspace. Any backend details not explicitly reproduced in the conversation transcript are marked as **[REQUIRES VERIFICATION]** so the next engineering session does not hallucinate schemas or routes.

### Project Overview

* **Project Name**: **PRISM** (Playground Risk Information System & Monitoring).
* **Purpose**: A multi-tenant enterprise geospatial risk monitoring, 360° digital twin inspection, and automated maintenance ticket dispatch platform.
* **Target Users**:
1. **Municipal Management / Asset Owners** (e.g., *Perbadanan Putrajaya*): Monitor regional playground assets via a macro/micro GIS dashboard, inspect 360° panoramic digital twins with defect hotspots, and perform final quality verification (Stage 5) on completed maintenance work.
2. **Contracted Maintenance Groups / Technicians** (e.g., *Putrajaya Coating & Paint*, *Apex Welding*): Receive auto-dispatched maintenance tickets, perform on-site repairs, and submit resolution notes/evidence.


* **Current Development Stage**:
* **Backend**: Core identity authentication (`/api/identity/login`) and ticket management modules (`tickets.routes.js`, `tickets.controller.js`, `tickets.service.js`, `tickets.model.js`) have been developed locally, alongside a relational database schema (`Database_Schema_PRISM.xlsx`).
* **Frontend**: Vite + React (TypeScript) project initialized. The unified `LoginPage` (with Apple-style refractive glassmorphism, animated canvas network grid, and cyber-HUD telemetry) is **complete and verified**. The `ManagementDashboard` shell with Mapbox GL JS is **scaffolded as a prototype** but currently uses hardcoded mock data instead of live backend API calls.


* **Scope Boundaries & Constraints**:
* Strictly multi-tenant: No organization or region names (e.g., `"PUTRAJAYA"`), coordinates, or asset lists may be hardcoded in frontend components; all data must be dynamically resolved from the authenticated user's organization/region via backend APIs.



---

## 2. Technology Stack

### Confirmed Stack

| Layer | Technology | Status / Notes |
| --- | --- | --- |
| **Frontend Framework** | React 18+ with TypeScript | Initialized via Vite (`react-ts` template) |
| **Build Tool & Dev Server** | Vite (`http://localhost:5173`) | Uses strict TypeScript settings (`verbatimModuleSyntax: true`) |
| **Frontend Routing** | `react-router-dom` | Installed and used for role-based navigation |
| **GIS & Mapping** | `mapbox-gl`, `@types/mapbox-gl` | Mapbox GL JS (`dark-v11` style, GeoJSON polygon layers, custom markers) |
| **Styling System** | Inline TypeScript `CSSProperties` + Scoped `<style>` | Custom reusable `<AppleGlassCard>` & HTML5 `<canvas>` backgrounds |
| **Backend Runtime & Framework** | Node.js + Express.js (JavaScript) | Confirmed via module structure (`*.routes.js`, `*.controller.js`, `*.service.js`, `*.model.js`) |
| **Database** | Relational SQL Database (PostgreSQL / MySQL) | **[REQUIRES VERIFICATION]** Exact SQL dialect and ORM/query driver (`pg` / `mysql2` / Prisma / Sequelize) must be verified from backend `package.json` |
| **Package Manager** | `npm` | Confirmed via terminal logs |

### Environment Variables (By Name Only)

* **Frontend (`.env`)**:
* `VITE_MAPBOX_ACCESS_TOKEN` *(Currently placeholder `'YOUR_MAPBOX_ACCESS_TOKEN'` in `ManagementDashboard.tsx`; should be moved to `.env`)*
* `VITE_API_BASE_URL` *(Optional if using Vite dev server proxy for `/api`)*


* **Backend (`.env`)** **[REQUIRES VERIFICATION]**:
* `PORT`
* `DATABASE_URL` (or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
* `JWT_SECRET`



### Development Commands

* **Frontend Directory**: `C:\Users\danis\Documents\PRISM\frontend\prism-frontend\prism-frontend` *(Note: nested double `prism-frontend` folder created during Vite scaffolding)*
* Start dev server: `npm run dev`
* Install packages: `npm install <package>`
* Build production bundle: `npm run build`


* **Backend Directory**: **[REQUIRES VERIFICATION]** (Likely `C:\Users\danis\Documents\PRISM\backend`)

---

## 3. System Architecture

### Application Layers & Responsibilities

1. **Presentation Layer (`prism-frontend/src/`)**:
* **Pages (`src/pages/`)**: View controllers handling user input, local state, API fetching, and route transitions (`LoginPage.tsx`, `ManagementDashboard.tsx`).
* **Reusable UI & Visual Components (`src/components/`)**:
* `AppleGlassCard.tsx`: Refractive dark-navy glassmorphism container with specular top-edge highlight and ambient sheen.
* `CyberGridBackground.tsx`: DPI-aware, `prefers-reduced-motion`-compliant HTML5 Canvas network particle and coordinate grid renderer.
* `SpinningGlobe.tsx`: Legacy 3D dot-matrix canvas component (superseded on Login page by `CyberGridBackground.tsx`).




2. **API Routing & Controller Layer (Backend)**:
* Follows a layered **Routes → Controller → Service → Model** pattern (confirmed by `tickets.routes.js`, `tickets.controller.js`, `tickets.service.js`, `tickets.model.js`).
* **Identity Module (`/api/identity/*`)**: Handles credential verification, token issuance, and user/organization payload generation.
* **Tickets Module (`/api/tickets/*`)**: Handles ticket creation, auto-dispatch to maintenance groups, technician resolution updates, and management verification.
* **Regions / Sites / Assets Module**: **[REQUIRES VERIFICATION]** Responsible for serving regional GeoJSON boundaries, owned playground counts, and asset pin coordinates/statuses.



### Request Lifecycle & Authentication Flow

1. **Authentication**:
* Client submits `POST /api/identity/login` with `{ email, password }`.
* Server validates credentials and returns `{ token, user }`.
* Client stores `prism_token` (JWT/Bearer token) and `prism_user` (serialized JSON) in `localStorage`.


2. **Role-Based Routing Enforcement**:
* Frontend inspects `data.user?.organizationId`:
* **Truthy (`user.organizationId` present)**: User belongs to an asset-owning management organization (e.g., Perbadanan Putrajaya) → Redirects to `/management/dashboard`.
* **Falsy (`user.organizationId` null/undefined)**: User belongs to a maintenance contractor group → Redirects to `/maintenance/dashboard`.




3. **Vite API Proxy**:
* `LoginPage.tsx` calls relative path `fetch('/api/identity/login')`. **[REQUIRES VERIFICATION]**: Verify `vite.config.ts` has `server.proxy: { '/api': 'http://localhost:<BACKEND_PORT>' }` configured.



---

## 4. Database and Data Model

> **Note**: The exact DDL in `Database_Schema_PRISM.xlsx` and `tickets.model.js` is not mounted in this session. Below are the confirmed entities, relationships, and business rules established across the project, alongside specific fields that require verification.

### Confirmed Entities & Relationships

1. **Organizations (`organizations`)**
* Represents municipal authorities/asset owners (e.g., *Perbadanan Putrajaya*).
* **1:N** relationship with `users` (Management users have an `organizationId`).
* **1:N** relationship with `regions` / `sites` (Playgrounds owned by the organization).


2. **Maintenance Groups (`maintenance_groups` / `contractors`)** **[REQUIRES VERIFICATION of exact table name]**
* Represents specialized repair contractors (e.g., *Putrajaya Coating & Paint*, *Apex Welding*).
* Linked to maintenance technicians (`users` where `organizationId` is null, or via a `maintenanceGroupId` foreign key) and assigned tickets.


3. **Users (`users`)**
* **Confirmed Fields**: `id`, `email`, `password` (hashed), `organizationId` (nullable FK to `organizations`).
* **[REQUIRES VERIFICATION]**: Role enum column or maintenance group FK (`maintenanceGroupId` / `role`).


4. **Regions (`regions`)**
* Represents geographic municipal zones (e.g., Putrajaya, Cyberjaya).
* **Confirmed Business Requirements**: Must store or provide the region name (`name`), boundary polygon geometry (GeoJSON coordinates for rendering the dashed perimeter in Mapbox), and center coordinates.


5. **Sites / Playground Assets (`sites` or `assets`)** **[REQUIRES VERIFICATION of exact table split]**
* Represents physical playground locations and inspectable equipment.
* **Confirmed Fields/Attributes Required by UI**:
* `id` (Primary Key)
* `name` (e.g., playground name)
* `regionId` / `organizationId` (FK for multi-tenant filtering and "Owned" count calculation)
* `latitude`, `longitude` (Decimal/Float coordinates for Mapbox pin placement)
* `status` (Derived or stored status: `'CLEAR'` [Green pin] vs. `'PENDING'` / `'MAINTENANCE PENDING'` [Red pin])
* 360° panoramic image URL / digital twin metadata and manual defect hotspots.




6. **Tickets (`tickets`)**
* Managed by `tickets.model.js` and `tickets.service.js`.
* **Confirmed Lifecycle States**: Tracks defects from reporting/hotspot creation → auto-dispatch to specialized maintenance group → technician resolution notes → Stage 5 management verification (Approve/Reject).
* **Referential Integrity & Status Rule**: An asset pin on the Management Mapbox viewer remains Red (`PENDING`) while any active/unverified ticket exists for that asset, and only transitions back to Green (`CLEAR`) once Management approves the resolution in Stage 5.



---

## 5. API and Integration Contracts

### 5.1 Implemented & Confirmed Endpoints

#### `POST /api/identity/login`

* **Purpose**: Authenticates management and maintenance users and returns session token + role-routing metadata.
* **Authentication**: Public.
* **Headers**: `Content-Type: application/json`
* **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "plainTextPassword"
}

```


* **Success Response (`200 OK`)**:
```json
{
  "token": "<jwt_string>",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "organizationId": "org_123"
  }
}

```


* **Error Response (`4xx` / `5xx`)**:
```json
{
  "error": "Invalid credentials or error message"
}

```


* **Implementation Status**: Implemented in backend; integrated in `src/pages/LoginPage.tsx`.

#### Tickets Module Endpoints (`tickets.routes.js`)

* **Implementation Status**: Implemented in `tickets.routes.js`, `tickets.controller.js`, `tickets.service.js`, and `tickets.model.js`, but **exact route paths and payloads require file inspection** in the new chat.
* **Expected Operations**:
* Create ticket & trigger auto-dispatch based on defect category/specialty.
* List tickets (filtered by `organizationId`, `regionId`, or assigned maintenance group).
* Submit technician resolution notes (Stage 4).
* Management verification approve/reject endpoint (Stage 5).



---

### 5.2 Frontend-Expected Endpoints (Pending Integration / Verification)

The `ManagementDashboard.tsx` UI (`image_d28a6a.jpg`) requires dynamic data for the top HUD bar, Mapbox boundary layer, and playground pins. **Currently, `ManagementDashboard.tsx` uses hardcoded mock state and does NOT fetch from the backend.**

| Required Data in `ManagementDashboard.tsx` | Expected Backend Endpoint (To Verify or Implement) | Required Response Data | Status |
| --- | --- | --- | --- |
| **Region Metadata, Boundary & Dropdown List** | `GET /api/regions` or `GET /api/management/overview` | List of regions accessible to `user.organizationId`, active region `name`, center `[lng, lat]`, and GeoJSON `Polygon` boundary coordinates. | **PENDING FRONTEND INTEGRATION** (Verify if backend route exists) |
| **Dashboard Telemetry ("Owned" & "Ticket Status" Bar)** | `GET /api/sites` / `GET /api/assets` or `GET /api/tickets/summary` | `totalOwned` count, `clearCount` (assets with 0 open tickets), `pendingCount` (assets with open tickets). | **PENDING FRONTEND INTEGRATION** |
| **Playground Map Pins** | `GET /api/sites?regionId=...` (or `/api/assets`) | Array of playground locations: `[{ id, name, latitude, longitude, status: 'CLEAR' | 'PENDING' }]`. | **PENDING FRONTEND INTEGRATION** |
| **360° Digital Twin & Hotspots** | `GET /api/assets/:id/twin` or `/api/sites/:id` | 360° equirectangular panorama URL + array of 3D/spherical hotspot coordinates & linked ticket statuses. | **PLANNED / PENDING** |

---

## 6. Business Logic and Workflows

### Workflow 1: Unified Login & Role-Based Redirection

1. **Trigger**: User submits email and password on `LoginPage.tsx`.
2. **Processing**:
* `POST /api/identity/login` authenticates user.
* Token and user object are persisted to `localStorage` (`prism_token`, `prism_user`).


3. **Routing Decision**:
* If `data.user?.organizationId` is truthy → `navigate('/management/dashboard')`.
* Otherwise → `navigate('/maintenance/dashboard')`.



### Workflow 2: Macro/Micro Geospatial Monitoring (Management Dashboard)

1. **Trigger**: Management user lands on `/management/dashboard` or changes the `Location` dropdown in the top glass HUD (`image_d28a6a.jpg`).


2. **Required Processing (To replace current mock data)**:
* Read `prism_user` and `prism_token` from `localStorage`.
* Fetch the organization's regions and assets from the backend API with header `Authorization: Bearer <prism_token>`.
* Render the selected region's name in the HUD header, update `Owned : <count>`, and compute the green/red ratio bar (`clearCount / totalOwned`).
* Update the Mapbox `region-boundary` GeoJSON source with the region's polygon coordinates and fly the camera (`map.flyTo`) to the region center.
* Render interactive circular pins (`#22c55e` for `CLEAR`, `#ef4444` for `PENDING`) at each playground's `[longitude, latitude]`.
* Filter visible pins or fly to a matching asset when the user types in the bottom `search` bar.



### Workflow 3: End-to-End Ticket Lifecycle & Stage 5 Verification

1. **Stage 1–3 (Detection & Auto-Dispatch)**: A defect hotspot is logged on a playground asset's 360° Digital Twin. The backend service (`tickets.service.js`) automatically routes/dispatches the ticket to the appropriate contracted maintenance group (e.g., *Putrajaya Coating & Paint* for surface/paint issues, *Apex Welding* for structural metalwork). The asset's map pin status becomes `PENDING` (Red).
2. **Stage 4 (Technician Resolution)**: The maintenance contractor logs into `/maintenance/dashboard`, views assigned tickets, performs the repair, and submits resolution notes/photos.
3. **Stage 5 (Management Verification)**: Management reviews the resolution in the Verification Queue:
* **Approve**: Ticket status closes/verifies; if no other open tickets remain on that playground, the asset status returns to `CLEAR` and its Mapbox pin turns Green (`#22c55e`).
* **Reject**: Ticket remains open/re-dispatched; asset pin stays Red (`#ef4444`).



---

## 7. Feature Status Inventory

| Feature / Module | Status | Relevant Files / Modules | Outstanding Work & Verification Requirements |
| --- | --- | --- | --- |
| **Unified Login UI & Role Redirection** | **Implemented and Verified** | `src/pages/LoginPage.tsx`<br>

<br>`src/components/AppleGlassCard.tsx`<br>

<br>`src/components/CyberGridBackground.tsx` | Production-ready. Includes `React.memo` `ScrambleText` HUD, show/hide password toggle, keyboard accessibility, and reduced-motion support. |
| **Favicon & Tab Branding** | **Implemented / Ready** | `public/prism-logo.png` (or `.svg`)<br>

<br>`index.html` | User selected the right-hand borderless cyan/blue hexagon logo (`image_d2e559.png`). Verify `<link rel="icon">` is saved in `index.html`.

 |
| **Backend Identity API (`/api/identity/login`)** | **Implemented (Backend)** | Backend identity routes/controller **[REQUIRES VERIFICATION]** | Verify JWT expiration handling and middleware attachment for protected routes. |
| **Backend Tickets Module** | **Implemented but Not Verified in Current Chat** | `tickets.routes.js`<br>

<br>`tickets.controller.js`<br>

<br>`tickets.service.js`<br>

<br>`tickets.model.js` | Inspect these 4 files at the start of the new chat to verify exact endpoint URLs and SQL queries. |
| **Management Mapbox Dashboard Shell** | **Partially Implemented (Prototype Only)** | `src/pages/ManagementDashboard.tsx` | **CRITICAL**: Currently hardcodes `'PUTRAJAYA'`, mock polygon coordinates, and 6 mock assets. Must be wired to live backend APIs and refined to match `image_d28a6a.jpg` exactly.

 |
| **360° Digital Twin & Hotspot Viewer Modal** | **Planned / Not Implemented** | To be created in `src/components/` | Clicking a Mapbox pin currently triggers `alert()`. Needs a 360° panorama viewer modal with hotspot markers. |
| **Stage 5 Verification Queue UI** | **Planned / Not Implemented** | To be created in `src/pages/` or `src/components/` | Needs management UI to approve/reject technician resolution submissions. |
| **Maintenance Contractor Dashboard** | **Planned / Not Implemented** | `/maintenance/dashboard` route | Referenced in `LoginPage.tsx` redirection (`navigate('/maintenance/dashboard')`), needs page implementation. |

---

## 8. Bugs, Technical Debt, and Code Quality

### P0 — Critical Bugs & Architectural Violations

1. **Hardcoded Multi-Tenant Data in `ManagementDashboard.tsx` (Confirmed Bug)**:
* **Issue**: `ManagementDashboard.tsx` initializes state with `useState('PUTRAJAYA')`, hardcoded counts (`6`, `4`, `2`), a hardcoded bounding box polygon, and a `mockAssets` array.
* **Impact**: Violates the core multi-tenant architecture of PRISM and ignores the backend API.
* **Fix**: Replace all static state in `ManagementDashboard.tsx` with `useEffect` API calls authenticated via `localStorage.getItem('prism_token')` and scoped to the logged-in user's organization/regions.


2. **Placeholder Mapbox Token in `ManagementDashboard.tsx**`:
* **Issue**: `mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';` will fail to load map tiles until replaced with `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN`.


3. **Nested Frontend Directory Structure (Confirmed Environment Quirks)**:
* **Issue**: Running `npm create vite@latest prism-frontend` inside `prism-frontend` created `C:\Users\danis\Documents\PRISM\frontend\prism-frontend\prism-frontend\package.json`.
* **Impact**: Running `npm run dev` in `C:\Users\danis\Documents\PRISM\frontend` or the outer `prism-frontend` throws `npm error Missing script: "dev"`.



### P1 — UI/UX Discrepancies Against Design Mockup (`image_d28a6a.jpg`

)

1. **Top Bar Layout Alignment**:
* In the user's design (`image_d28a6a.jpg`), the top-right notification/settings/profile pill (`🔔 ⚙️ 👤`) is a **separate floating glass pill** in the top-right corner of the screen, and the hamburger menu (`☰`) is a standalone icon in the top-left corner, while the central HUD card (`PUTRAJAYA` | `Owned : 6` | `Ticket Status :` | `Location :`) is centered horizontally at the top of the viewport with vertical dividers (`|`) between the 3 stat columns.


* In the current `ManagementDashboard.tsx` draft, the `🔔 ⚙️ 👤` buttons were placed *inside* the central `AppleGlassCard` header row instead of their own top-right floating glass container.


2. **Map Pin Styling**:
* In `image_d28a6a.jpg`, the pins are **teardrop map pins** with a white inner circle and colored outer body (Green `#22c55e` or Red `#ef4444`), whereas the draft code rendered simple circles (`borderRadius: '50%'`).




3. **Mapbox Zoom Controls**:
* `image_d28a6a.jpg` shows `+` / `-` zoom buttons at the bottom-right corner. `ManagementDashboard.tsx` needs `map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')`.





### P2 — Code Quality & TypeScript Strictness

1. **`verbatimModuleSyntax` Enforcement**:
* The Vite TypeScript configuration enforces `verbatimModuleSyntax: true`. Importing React types (`ReactNode`, `CSSProperties`, `FormEvent`) without `import type` causes compilation errors. Always use `import type { ... } from 'react'`.


2. **Unused `React` Default Imports**:
* `noUnusedLocals` is active in `tsconfig.json`. Do not include `import React from 'react'` unless `React.*` is explicitly referenced in the file.



---

## 9. Technical Decisions and Rejected Approaches

| Decision Area | Chosen Approach | Rejected Alternatives & Reasoning |
| --- | --- | --- |
| **Login Background Visuals** | **Animated Cyber Network Grid (`CyberGridBackground.tsx`)** with center-attenuated particle opacity, DPI scaling, radial vignette, and `prefers-reduced-motion` support. | 1. Static City Image (`image_e092cb.jpg`): Rejected by user in favor of procedural animation.

<br>

<br>2. *3D Spinning Dot Globe (`SpinningGlobe.tsx`)*: Built and tested (`image_d5b9c0.png`, `image_d5b1e0.png`), then rejected by user because the center-clustered globe left the outer viewport feeling empty. Do not revert to `SpinningGlobe.tsx`.

 |
| **Glassmorphism Implementation** | **Reusable `<AppleGlassCard>` Component** using deep slate-navy translucent fill (`rgba(15, 23, 42, 0.82)`), `backdrop-filter: blur(24px) saturate(140%)`, 1px top specular highlight, and multi-layered inner rim shadows. | *Flat CSS translucent cards (`rgba(255,255,255,0.04)`)*: Rejected because low-opacity white washed out contrast and lacked physical edge refraction. |
| **HUD Telemetry Text** | **Memoized `ScrambleText` Component** displaying fixed engineering telemetry (`SYSTEM: ONLINE // PRISM V1.0` and `LAT: 42.9264° N | LNG: 101.253° E (Mapskart Technologies)`). |
| **Brand Icon / Favicon** | Borderless Cyan-Blue Gradient Hexagon (`image_d2e559.png` — Right Icon) for browser favicon and in-app UI.

 | *Rounded-square solid blue icon (Left Icon)*: Reserved only for OS-level app launchers (`apple-touch-icon`); too boxy for dark glass UI and browser tabs. |
| **Authentication Architecture** | **Unified Login Endpoint (`/api/identity/login`)** with client-side role redirection based on `user.organizationId`. | *Separate login pages for Management vs. Maintenance*: Rejected in favor of a single enterprise gateway. |

---

## 10. Developer Workflow and Conventions

### Directory Structure

```text
C:\Users\danis\Documents\PRISM\
├── backend\                              # [REQUIRES VERIFICATION of exact path]
│   ├── tickets.routes.js
│   ├── tickets.controller.js
│   ├── tickets.service.js
│   ├── tickets.model.js
│   └── ... (identity, regions, sites/assets modules)
└── frontend\
    └── prism-frontend\
        └── prism-frontend\               # Active Vite root (where package.json lives)
            ├── index.html
            ├── package.json
            ├── tsconfig.json
            ├── vite.config.ts
            ├── public\
            │   └── prism-icon.svg        # Favicon asset
            └── src\
                ├── main.tsx
                ├── App.tsx               # React Router setup
                ├── components\
                │   ├── AppleGlassCard.tsx
                │   ├── CyberGridBackground.tsx
                │   └── SpinningGlobe.tsx # Unused legacy component
                └── pages\
                    ├── LoginPage.tsx
                    └── ManagementDashboard.tsx

```

### Coding & Style Conventions

* **Design Tokens**:
* Background Base: `#020617` to `#091326`
* Primary Accent: `#38bdf8` (Sky Cyan) / `#0284c7` to `#0369a1` (Action Gradient)
* Status Colors: `#22c55e` (Clear / Green), `#ef4444` (Pending / Red), `#f43f5e` (Region Dashed Border)
* Typography: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` for UI; `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` with `tabular-nums` for HUD coordinates and metrics.


* **TypeScript Rules**:
* Always use `import type` for type-only imports (`verbatimModuleSyntax`).
* Add `as const` to inline style properties like `position`, `pointerEvents`, `flexDirection`, `boxSizing`, and `textTransform` so TypeScript's `CSSProperties` checker does not fail.



---

## 11. Prioritised Backlog

### P0 — Blockers & Critical Correctness Issues

1. **Inspect Backend API & Wire `ManagementDashboard.tsx` to Real Endpoints**
* **Objective**: Eliminate all hardcoded `"PUTRAJAYA"` strings, mock counts, mock polygons, and mock asset pins from `ManagementDashboard.tsx`.
* **Affected Modules**: `src/pages/ManagementDashboard.tsx`, backend Region/Site/Ticket routes.
* **Acceptance Criteria**:
* Region title, `Owned` count, `Ticket Status` bar (`Clear` vs `Pending`), `Location` dropdown options, Mapbox boundary polygon, and playground pins are dynamically populated from the backend API using the logged-in user's token/organization.


* **Verification**: Log in via `LoginPage.tsx`, land on `/management/dashboard`, and verify in browser DevTools Network tab that `GET` requests populate the HUD and Mapbox layers dynamically.



### P1 — Essential Next Implementation Tasks

2. Align `ManagementDashboard.tsx` Layout Precisely with UI Mockup (`image_d28a6a.jpg`)


* **Objective**: Match the exact visual layout of `image_d28a6a.jpg`.


* **Affected Modules**: `src/pages/ManagementDashboard.tsx`.
* **Acceptance Criteria**:
* Top-left hamburger menu (`☰`), top-center HUD glass card (with vertical dividers `|` between `Owned`, `Ticket Status`, and `Location`), and top-right glass pill (`🔔 ⚙️ 👤`) are positioned as three distinct floating elements.
* Map pins use SVG teardrop markers (white center, green/red body) instead of plain circles.
* Bottom-right `+` / `-` zoom control is rendered.




3. **Implement 360° Digital Twin & Hotspot Inspection Modal**
* **Objective**: Replace the placeholder `alert()` when clicking a playground pin with the interactive 360° viewer and defect hotspot inspector.
* **Affected Modules**: `src/components/DigitalTwinModal.tsx` (new), `src/pages/ManagementDashboard.tsx`.


4. **Implement Stage 5 Ticket Verification Queue & Maintenance Dashboard**
* **Objective**: Connect `tickets.routes.js` / `tickets.controller.js` to the frontend so Management can approve/reject technician resolutions and Maintenance users have a working `/maintenance/dashboard`.



### P2 — Improvements & Refactoring

5. **Centralize API Client & Auth Guard (`ProtectedRoute`)**
* **Objective**: Create an API helper that automatically attaches `Authorization: Bearer ${localStorage.getItem('prism_token')}` and redirects to `/login` on `401 Unauthorized`.



---

## 12. Outstanding Questions and Verification Checklist

Before writing new code in the next chat, the AI assistant must verify the following by asking the developer to share or paste the relevant files:

* [ ] **Backend Route Inventory**: What are the exact route paths and response shapes in `server.js` / `app.js`, `regions` routes, `sites`/`assets` routes, and `tickets.routes.js`?
* [ ] **Database Schema (`Database_Schema_PRISM.xlsx`)**: What are the exact column names for `regions` (specifically how the GeoJSON boundary polygon is stored) and `sites`/`assets` (how `latitude`, `longitude`, and `status` are returned)?
* [ ] **Vite Proxy Configuration**: Does `vite.config.ts` already proxy `/api` to the backend port, and what port is the Express backend running on?
* [ ] **Mapbox Access Token**: Is a `.env` file configured with `VITE_MAPBOX_ACCESS_TOKEN` in `prism-frontend/prism-frontend/`?

---

## START HERE IN THE NEW CHAT

Copy and paste this document into the new chat, along with the contents of your backend route/controller files (or `Database_Schema_PRISM.xlsx`), and give the new AI these instructions:

1. **Current Project State**:
* **PRISM** is a multi-tenant geospatial playground risk monitoring platform (Node/Express backend + Vite/React/TS frontend).
* The unified `LoginPage.tsx` (with `AppleGlassCard.tsx` and `CyberGridBackground.tsx`) is **complete and verified**.
* `ManagementDashboard.tsx` has an initial Mapbox GL JS scaffold, but it **incorrectly uses hardcoded `"PUTRAJAYA"` and mock data** instead of calling our backend APIs.


2. **Single Most Important Next Task**:
* Refactor `src/pages/ManagementDashboard.tsx` to fetch the authenticated organization's regions, boundary polygon GeoJSON, owned playground count, ticket status breakdown (`Clear` vs `Pending`), and playground pin coordinates/statuses **dynamically from our backend API**, while matching the exact HUD layout in `image_d28a6a.jpg`.




3. **Files to Inspect First**:
* Backend route & controller files for **Regions / Sites (Assets) / Tickets** (`tickets.routes.js`, `tickets.controller.js`, `tickets.service.js`, `tickets.model.js`, and the main `app.js`/`server.js` file).
* Frontend `src/pages/ManagementDashboard.tsx` and `src/App.tsx`.


4. **Constraints the Next AI Must Respect**:
* **NEVER hardcode tenant/region data** (like `"Putrajaya"`, static asset arrays, or static counts) in the frontend. Everything must come from the backend API.
* Preserve the Apple-refractive glassmorphism aesthetic (`AppleGlassCard.tsx`) and dark-navy (`#020617`) visual identity.
* Respect TypeScript `verbatimModuleSyntax` (always use `import type` for types and avoid unused `React` imports).


5. **Missing Information Not to Assume**:
* Do not guess backend endpoint URLs or database column names for regions/assets/tickets—ask to see the backend route/controller files or schema first if they haven't been pasted yet.