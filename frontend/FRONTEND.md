# openDrive — Frontend Design

## Stack

| Layer | Choice |
|---|---|
| Framework | React + Vite (TypeScript) |
| UI Components | Mantine |
| Auth / Global State | Zustand |
| Server State / API calls | TanStack Query (React Query) |
| Routing | React Router |

---

## Folder Structure

```
frontend/
├── src/
│   ├── api/              # API call functions (used by React Query)
│   │   ├── auth.ts
│   │   ├── fs.ts
│   │   └── admin.ts
│   ├── components/       # Reusable UI components
│   │   ├── FileTable.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── UploadDropzone.tsx
│   │   └── CreateFolderModal.tsx
│   ├── pages/            # Route-level pages
│   │   ├── LoginPage.tsx
│   │   ├── FilesPage.tsx
│   │   └── AdminPage.tsx
│   ├── store/
│   │   └── auth.ts       # Zustand auth store (token + user)
│   ├── hooks/            # Custom hooks wrapping React Query calls
│   │   ├── useFiles.ts
│   │   └── useUsers.ts
│   ├── router.tsx        # React Router config
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

---

## Routing

```
/login              → LoginPage
/files              → FilesPage (root of user's storage)
/files/*            → FilesPage (nested path, e.g. /files/docs/reports)
/admin              → AdminPage (admin only)
```

Current folder path lives in the URL — no state needed for navigation. Deep links and browser back/forward work for free.

---

## State Management

### Zustand — Auth store only

```ts
// store/auth.ts
{
  token: string | null
  user: { id, username, role } | null
  setAuth(token, user): void
  clearAuth(): void
}
```

Token is persisted to `localStorage`. On app load, if a token exists, fetch `/api/auth/me` to validate it.

### TanStack Query — All API/server state

- File listing, upload, delete, mkdir, move → via React Query mutations/queries
- User management (admin) → via React Query
- Automatic loading states, error handling, and cache invalidation

No manual `useState` for API data.

---

## Pages

### LoginPage
- Simple centered form: username + password
- On submit → `POST /api/auth/login` → store token → redirect to `/files`

### FilesPage
- **Breadcrumb** — derived from the URL path, clickable segments
- **Toolbar** — Upload button, New Folder button
- **FileTable** — lists folders and files at the current prefix
  - Columns: Name, Size, Last Modified, Actions (download, delete, rename)
  - Folders are clickable (navigate into)
- **UploadDropzone** — drag and drop overlay on the page, or click Upload button
- Upload shows progress per file

### AdminPage (admin role only)
- Table of all users
- Create user button → modal with username + password fields
- Delete user, change password actions per row

---

## Key Mantine Components Used

| Feature | Mantine Component |
|---|---|
| File drag & drop upload | `Dropzone` (`@mantine/dropzone`) |
| File/folder table | `Table` |
| Breadcrumb nav | `Breadcrumbs` |
| Create folder / confirm delete | `Modal` |
| Upload progress | `Progress` |
| Notifications (success/error) | `notifications` (`@mantine/notifications`) |
| Admin user form | `TextInput`, `PasswordInput`, `Button` |
| Layout | `AppShell` (sidebar + main area) |

---

## Auth Flow

1. App loads → check Zustand for token
2. If token exists → call `GET /api/auth/me` to validate
3. If valid → proceed; if invalid/expired → clear token, redirect to `/login`
4. All API requests send `Authorization: Bearer <token>` header
5. On 401 response → clear auth, redirect to `/login`

---

