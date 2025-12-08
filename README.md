# Voyis Image Miniproject

Electron-based desktop application for uploading, syncing and viewing image data from a mock server environment (Docker + PostgreSQL + REST API).  

The app focuses on:

- Reliable server‑side storage and metadata tracking
- A gallery viewer with filtering, selection, and batch download
- A single‑image viewer with pan/zoom and crop‑to‑new‑image
- A control panel and live system log to visualize synchronization with the server

---

## Technology Stack

**Frontend / Desktop**

- Electron + [electron-vite](https://github.com/alex8088/electron-vite) for dev/build pipeline
- React (hooks) for UI and state management
- `react-zoom-pan-pinch` for pan/zoom interactions in the single-image viewer
- `utif.js` for client-side TIF decoding into RGBA and drawing into `<canvas>`.
- A small Rust + WebAssembly image filter module (via `wasm-bindgen`) used for high‑performance grayscale conversion.

**Backend**

- Node.js + Express as the HTTP API server
- `multer` for multi-file uploads
- `sharp` for reading image metadata and performing crops
- `archiver` for batch ZIP downloads

**Data & Storage**

- PostgreSQL running in Docker for image metadata
- Local folder `server/images_storage` as mounted server storage for original and cropped images

### High-Level Diagram

```
+---------------------------+
| Electron Client (React)   |
| - Control Panel & Logs    |
| - Gallery Grid            |
| - Single-Image Viewer     |
+-------------+-------------+
              |
              | HTTP (REST, JSON)
              v
+---------------------------+
| Express API Server        |
| - /api/upload             |
| - /api/images             |
| - /api/crop               |
| - /api/download-zip       |
+------+--------------------+
       |                 |
       | Postgres        | Local FS
       v                 v
+--------------+   +------------------+
|  images DB   |   | images_storage/  |
| (metadata)   |   | (binary images)  |
+--------------+   +------------------+
```



## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Docker & Docker Compose**
- OS: Windows / macOS / Linux (developed on desktop)

### Start the Server Environment

1. **Start PostgreSQL via Docker Compose**

   From the `server` directory:

   ```shell
   cd server
   docker-compose up -d
   ```

   This starts a `voyis_db` Postgres container with database `voyis_data` and user `admin` / password `password` (see `index.js` and `docker-compose.yml`).

2. **Install and start the API server**

   From the `server` directory:

   ```shell
   cd server
   npm install
   npm start
   ```

   The server runs on **http://localhost:3000** and exposes the `/api/*` and `/uploads/*` endpoints.

### Run the Electron Client

In a separate terminal:

```shell
cd client
npm install
npm run dev 
```

- This starts Electron in development mode, using the React renderer.
- The renderer communicates with `http://localhost:3000` for all server operations.

![image-20251207192148812](/assets/initial-launch.png)

![image-20251207194515409](/assets/uploaded-images.png)

### Testing

- Use the `test images` folder in the repo or any public image dataset (satellite imagery, maps, scanned documents, etc.).
- Include a mix of JPG/PNG/TIF files and at least one intentionally corrupted image to validate corrupted‑count logic and robustness of the upload path.



## Synchronization Strategy

### Strategy: **Server Authority (Server Always Wins)**

The application treats the **server-side** (PostgreSQL DB + `images_storage` volume) as the single source of truth. The local Electron client holds only transient UI state and does **not** maintain its own persistent database.

#### How It Works

- **Read / Sync**
  - On app startup and whenever the user clicks **Sync with Server**, the client:
    - Calls `GET /api/images`
    - Discards the previous `images` state
    - Rebuilds the UI based solely on the server response
- **Write**
  - All mutating operations (file upload, crop) are performed on the server first:
    - Upload → `/api/upload`
    - Crop → `/api/crop`
  - Only after the server confirms success does the client refresh its local state via another sync.

#### Conflict Handling

Because the client never applies local changes without first going through the server, conflicts are resolved automatically in favor of the server:

- If another user or process modifies the server state (e.g., new images added via another client), clicking  **Sync with Server**, overwrites the local view with the server’s latest truth.

In other words:

> **If local UI and server data disagree, the server version always wins.**

## Scalability & Performance Design

The current implementation targets modest datasets (hundreds to low thousands of images), but its design can be extended to 100k+ images as follows.

### Design Decisions Already Helping Scalability

1. **Separation of binary data and metadata**
   - Only the metadata is stored in PostgreSQL, while image binaries live in `images_storage`.
   - keeps DB size manageable and indexing fast.
2. **Single metadata table**
   - `images` uses simple, indexable fields (`created_at`, `filename`, etc.), making it easy to add DB indexes and query tuning later.
3. **Thin client state**
   - Leveraging the server as the authority simplifies introducing pagination and server-side filters later without heavy client-side caching.

### Future Optimizations (If Scaling to 100k+ Images)

We can have changes in the following sides:

**Database / API**

- Add indexes on frequently queried columns, e.g.:
  - `CREATE INDEX idx_images_created_at ON images(created_at DESC);`
  - `CREATE INDEX idx_images_filename ON images(filename);`
- Replace `GET /api/images` (full scan) with **paginated** APIs:
  - `GET /api/images?page=1&pageSize=50`
  - Or cursor-based pagination: `GET /api/images?cursor=<id>&limit=50`
- Expose server-side filtering:
  - File type (`type`)
  - Date range (`created_at`)

**UI / Renderer**

- Implement **virtualized lists** / grids (e.g., `react-window` or `react-virtualized`) for the gallery so the DOM only renders visible tiles.
- Incremental loading:
  - Load the first N thumbnails quickly.
  - Lazy-load additional pages as the user scrolls.
- **Thumbnail vs Original Images**:
  - Generate and store smaller thumbnails alongside original images.
  - The gallery uses only thumbnails; the single-image viewer loads the original on demand.

**Syncing & Background Work**

- For very large datasets, **avoid full refetch on each sync**:
  - Implement incremental sync using `created_at` or incrementing IDs:
    - `GET /api/images?since=<lastSyncTimestamp>`
- Maintain a “last sync” watermark to only fetch updates.

## Current Limitations & Future Work

1. **Folder Config JSON (Batch Insert)**
   - Not yet implemented.
   - Future plan: support uploading a JSON file describing existing server directories and file patterns; the API would scan those locations and bulk-insert metadata into the `images` table.
2. **EXIF Data Extraction / Editing**
3. **WASM / Native Addons**
   - Current implementation already uses a small Rust + WASM module for a grayscale filter (`WASM Grayscale + Save` in the workspace).
   - Future : add more advanced filters and potentially move some heavy TIF processing into WASM as well.
4. **TIF Preview**
   - TIF preview is implemented using `utif.js` to decode into RGBA and draw onto a `<canvas>`.
   - Future improvements could include thumbnail caching.
5. **Authentication / Multi-User**

## Requirements Coverage

| Requirement (from brief)                      | Implementation                                               |
| --------------------------------------------- | ------------------------------------------------------------ |
| Upload JPG/PNG/TIF & show upload stats        | `/api/upload` + sidebar **Server Health** & **Last Upload Report** |
| Detect corrupted images                       | `sharp().metadata()` try/catch + `is_corrupted` flag         |
| Gallery with filter/selection/batch download  | Center gallery grid + type filter + `Download (N)` ZIP export |
| Single viewer with pan/zoom/crop to new image | Workspace view + `react-zoom-pan-pinch` + `/api/crop`        |
| Control panel & sync strategy                 | Left sidebar controls + **Sync with Server (Server wins)** button |
| Log of actions & feedback                     | **SYSTEM LOGS** panel in the sidebar                         |
| Optional WASM / native-addon feature          | WASM grayscale filter + TIF preview via UTIF                 |

## Development Notes

### Useful Commands

**Server**

```shell
cd server

# Start Postgres
docker-compose up -d

# Stop and remove DB container and volume
docker-compose down -v

# Inspect DB
docker exec -it voyis_db psql -U admin -d voyis_data
SELECT * FROM images;

# Run API server
npm install
npm start
```

**Client**

```shell
cd client
npm install
npm run dev        # Run Electron + React in dev mode
```