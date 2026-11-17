# People Operations frontend

The frontend is a React and TypeScript workspace for workforce, department, and leave management.

## Configure the app

Copy `.env.example` to `.env.local` and set values for the target company before starting Vite or building:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:4000/api` in development; `/api` in production |
| `VITE_ORGANIZATION_NAME` | Organization name shown in the sign-in and workspace navigation | `Your Organization` |
| `VITE_PRODUCT_NAME` | Product title and report metadata | `People Operations` |
| `VITE_PRODUCT_SHORT_NAME` | Compact workspace mark | `PO` |
| `VITE_WORKFORCE_LABEL` | Dashboard workforce terminology | `People` |
| `VITE_BRAND_PRIMARY_COLOR` | Primary brand color as a six-digit hex value | `#60a5fa` |
| `VITE_BRAND_ACCENT_COLOR` | Accent brand color as a six-digit hex value | `#2dd4bf` |

Vite embeds `VITE_*` values in the client bundle. Do not put credentials, private keys, or other secrets in these variables.

## Analyst reports

The dashboard summary is scoped by the signed-in user's permissions. Exported CSV rows include a record type, organization and product metadata, generation time, and viewer role. Employee and leave data are fetched from the API using the same authorization scope; CSV cells are escaped and guarded against spreadsheet formula execution.

## Development

Run `npm run dev` to start the frontend, `npm run build` for a production build and TypeScript check, or `npm run lint` to lint the source.
