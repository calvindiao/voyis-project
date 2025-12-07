# voyis-project





















docker-compose up -d

docker-compose down -v

docker exec -it voyis_db psql -U admin -d voyis_data

SELECT * FROM images;

npm run dev



npm start







**Synchronization Strategy: Server Authority (Server Always Wins)**

- **Strategy Description:** The application treats the Server (PostgreSQL DB & `images_storage` volume) as the "Single Source of Truth". The local Electron client does not maintain its own persistent database but acts as a viewer.
- **How it works:**
  - **Read:** When the application starts or the "Sync" button is clicked, it discards the current local state and fetches the latest list from the API (`GET /api/images`).
  - **Write:** All changes (Upload, Crop) are performed directly on the server first. The client only updates its UI after receiving a success response from the server.
- **Conflict Resolution:** If the local client is outdated (e.g., another user uploaded a file), the "Sync" action will overwrite the local view with the server's current state.
- **Risk:** The main risk is network latency. However, this avoids complex data inconsistency issues typical in "Local First" strategies, making the system more robust for a lightweight viewer.
- 