# WorkTree X — Environment Configuration

## Environment Variables
- `SUPABASE_URL`: Supabase REST API endpoint.
- `SUPABASE_PUBLISHABLE_KEY`: Public client key safe for browser exposure.
- `SUPABASE_SECRET_KEY`: Service role secret key; NEVER expose to browser.
- `ONESIGNAL_APP_ID`: OneSignal application identifier; safe for the browser and required by `notification-dispatch`.
- `ONESIGNAL_REST_API_KEY`: OneSignal server REST API key; Edge Function secret only.
- `PORT`: Server port (default `8080`).
