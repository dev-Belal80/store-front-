# Copilot instructions for store-app

## Project snapshot
- Frontend is Create React App + React 19 + Tailwind CSS (RTL Arabic UI).
- Main runtime entry is `src/index.js`, which mounts `src/App.jsx` (not `src/App.js`).
- Routing is role-based with nested layouts: `super_admin` under `/admin/*`, `store_owner` under `/store/*`.

## Architecture and data flow
- Route composition lives in `src/App.jsx`; auth gate is `src/components/shared/ProtectedRoute.jsx`.
- Layout shell is split by role: `src/layouts/AdminLayout.jsx` and `src/layouts/StoreLayout.jsx`, both using shared `Sidebar` + `Topbar`.
- Pages are feature-grouped under `src/pages/store/{customers,suppliers,products}` and call feature API modules in `src/api/*`.
- API client is centralized in `src/api/axios.js` with token injection (`auth_token`) and global 401/403 handling.
- Auth state is Zustand (`src/store/authStore.js`) and mirrors token/user in localStorage keys: `auth_token`, `auth_user`.
- Data fetching/mutations use React Query (`useQuery`, `useMutation`) and invalidate feature keys (example: `['customers']`, `['products']`).

## API and response-shape conventions
- Keep endpoint wrappers thin in `src/api/*.js` (one exported function per endpoint).
- Backend payload shapes vary; pages defensively normalize responses instead of assuming one schema.
- Prefer `normalizePaginatedResponse` from `src/utils/pagination.js` for list pages and statements.
- Existing pages may still parse `response.data.data` directly (see `ProductsPage.jsx`, `SuppliersPage.jsx`); preserve behavior unless intentionally refactoring.

## UI implementation patterns
- Reuse shared primitives first: `PageHeader`, `DataTable`, `LoadingSpinner`, `ConfirmDialog`, `BalanceDisplay`.
- Forms use `react-hook-form` + `zodResolver`; validation messages are Arabic.
- Toast feedback uses `react-hot-toast` for success/error in all CRUD flows.
- Styling uses Tailwind tokens from CSS variables (`text-text`, `border-border`, `bg-bg`) defined in `src/index.css` and `tailwind.config.js`.
- Keep RTL-friendly layouts/classes and Arabic copy consistent with current pages.

## Pagination and tables
- There are two pagination components in active use:
  - `src/components/shared/PaginationControls.jsx` (per-page selector, used by customers/categories/statements)
  - `src/components/shared/Pagination.jsx` (numbered pages, used by suppliers/products)
- Match the pagination component already used by the feature you edit unless explicitly standardizing.

## Auth and navigation rules
- `ProtectedRoute` redirects by role using `roleDashboardMap`; do not bypass this when adding routes.
- Login flow (`src/pages/auth/LoginPage.jsx`) extracts `access_token` + `user` and routes by `user.role`.
- Statements navigate from list pages via router state (`name`, `phone`, `balance`) and also support API-provided party details.

## Dev workflows
- Install deps: `npm install`
- Dev server: `npm start`
- Production build: `npm run build`
- Tests (watch mode): `npm test`
- Validate focused changes first (feature page + related shared component), then run full build before handoff.

## Practical guidance for agents
- When adding a new store feature, follow the existing slice pattern: `src/api/<feature>.js` + `src/pages/store/<feature>/<Feature>Page.jsx` + shared components.
- Keep query keys stable and specific (`[feature, page, filters...]`) to avoid stale cache collisions.
- Prefer adapting to inconsistent backend field names with local normalizers (examples in statement pages) over changing shared assumptions globally.
- If touching routing, update both route tree (`src/App.jsx`) and role layout navigation items (`AdminLayout`/`StoreLayout`).
