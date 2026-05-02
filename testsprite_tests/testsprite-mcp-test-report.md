
# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** nextjd-testsprite
- **Date:** 2026-05-01
- **Prepared by:** TestSprite AI Team
- **Environment:** Local — `http://localhost:3000` (Next.js 15 dev server, Turbopack)
- **Database:** MySQL via XAMPP socket (`todo_app`)
- **Runner:** Playwright 1.59.0 / Chromium Headless Shell 147.0

---

## 2️⃣ Requirement Validation Summary

### Requirement: User Onboarding & Registration
- **Description:** New users can register with name, email, and password and land on the todo list.

#### Test TC001 — New user onboarding reaches todo list and can add first todo
- **Test Code:** [TC001_New_user_onboarding_reaches_todo_list_and_can_add_first_todo.py](./TC001_New_user_onboarding_reaches_todo_list_and_can_add_first_todo.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** User navigated to `/`, was redirected to `/login`, then to `/register`. After filling name, unique email, and password ≥ 8 chars and submitting, the app created the user, set the `auth_token` JWT cookie, and redirected to `/todos`. A first todo was added and confirmed visible at the top of the list.

---

#### Test TC002 — Register a new account and land on the todo list
- **Test Code:** [TC002_Register_a_new_account_and_land_on_the_todo_list.py](./TC002_Register_a_new_account_and_land_on_the_todo_list.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `POST /api/auth/register` returned 201 with `auth_token` cookie set. Middleware confirmed authenticated session and redirected to `/todos`.

---

### Requirement: User Authentication (Login / Logout)
- **Description:** Existing users can sign in with email and password; authenticated sessions are managed via httpOnly JWT cookie.

#### Test TC003 — Log in with valid credentials and reach the todo list
- **Test Code:** [TC003_Log_in_with_valid_credentials_and_reach_the_todo_list.py](./TC003_Log_in_with_valid_credentials_and_reach_the_todo_list.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `POST /api/auth/login` verified bcrypt hash, issued a 7-day JWT, and set the httpOnly cookie. Middleware redirected to `/todos` on subsequent navigation.

---

#### Test TC005 — Logout from the todo list and return to login
- **Test Code:** [TC005_Logout_from_the_todo_list_and_return_to_login.py](./TC005_Logout_from_the_todo_list_and_return_to_login.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `POST /api/auth/logout` cleared the `auth_token` cookie. Subsequent navigation to a protected route was redirected to `/login` by middleware.

---

### Requirement: View Todo List
- **Description:** After login, the authenticated user's todos are fetched and rendered; empty state is shown when none exist.

#### Test TC004 — Todo list page loads and displays user todos after login
- **Test Code:** [TC004_Todo_list_page_loads_and_displays_user_todos_after_login.py](./TC004_Todo_list_page_loads_and_displays_user_todos_after_login.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `GET /api/todos` returned the user's todos ordered by `created_at DESC`. `GET /api/auth/me` returned the JWT payload. Both were rendered on `/todos` on page load.

---

### Requirement: Add Todo
- **Description:** Users can type a title and submit to create a new todo that appears at the top of the list.

#### Test TC006 — Add todo places new item at top of list
- **Test Code:** [TC006_Add_todo_places_new_item_at_top_of_list.py](./TC006_Add_todo_places_new_item_at_top_of_list.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `POST /api/todos` inserted the new row and returned it. The React state prepended the new item (`[todo, ...prev]`) placing it at index 0 in the rendered list.

---

### Requirement: Edit Todo Title
- **Description:** Double-clicking a todo title opens an inline edit input; Enter or blur saves; Escape cancels.

#### Test TC007 — Save edited todo title (via Enter key)
- **Test Code:** [TC007_Save_edited_todo_title.py](./TC007_Save_edited_todo_title.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Double-click triggered `setEditing(true)` and focused the inline input. Pressing Enter called `commitEdit()` which issued `PUT /api/todos/{id}` with the new title. Updated title was confirmed in the list.

---

#### Test TC014 — Save edited todo title by blurring input
- **Test Code:** [TC014_Save_edited_todo_title_by_blurring_input.py](./TC014_Save_edited_todo_title_by_blurring_input.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `onBlur` handler called `commitEdit()` on focus-out, issuing the same `PUT` request. Updated title confirmed rendered.

---

### Requirement: Toggle Todo Completion
- **Description:** Clicking a todo's checkbox toggles its completed state; completed todos display with strikethrough text.

#### Test TC010 — Toggle completion marks todo as completed with strikethrough
- **Test Code:** [TC010_Toggle_completion_marks_todo_as_completed_with_strikethrough.py](./TC010_Toggle_completion_marks_todo_as_completed_with_strikethrough.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Checkbox change issued `PUT /api/todos/{id}` with `completed: true`. React state updated immediately. The title `<span>` gained the `line-through text-gray-400` CSS classes confirming visual strikethrough.

---

### Requirement: Delete Todo
- **Description:** Hovering a todo reveals a delete (✕) button; clicking it removes the todo from the list.

#### Test TC009 — Delete a todo from the list
- **Test Code:** [TC009_Delete_a_todo_from_the_list.py](./TC009_Delete_a_todo_from_the_list.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Hover on the `<li>` made the ✕ button visible (`opacity-0 → group-hover:opacity-100`). Click issued `DELETE /api/todos/{id}`; ownership check via `user_id` passed. React filtered the item from state. Confirmed not in DOM.

---

### Requirement: Filter Todos
- **Description:** All / Active / Completed tabs filter the visible list; Active tab shows a badge with the count of incomplete items.

#### Test TC011 — Filter Completed shows only completed todos and active badge count updates
- **Test Code:** [TC011_Filter_Completed_shows_only_completed_todos_and_active_badge_count_updates.py](./TC011_Filter_Completed_shows_only_completed_todos_and_active_badge_count_updates.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** Selecting "Completed" filter set state to `filter === 'completed'`. Only completed todos were rendered. The Active tab badge showed the correct remaining count (1).

---

#### Test TC013 — Filter All shows both active and completed todos
- **Test Code:** [TC013_Filter_All_shows_both_active_and_completed_todos.py](./TC013_Filter_All_shows_both_active_and_completed_todos.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** "All" filter (`filter === 'all'`) rendered both active and completed items simultaneously. Both titles confirmed visible.

---

#### Test TC015 — Filter Active shows only incomplete todos
- **Test Code:** [TC015_Filter_Active_shows_only_incomplete_todos.py](./TC015_Filter_Active_shows_only_incomplete_todos.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** "Active" filter hid the completed item. Only the incomplete todo was rendered. Completed todo confirmed absent from DOM.

---

### Requirement: Clear Completed Todos
- **Description:** The "Clear completed" footer button deletes all completed todos at once.

#### Test TC008 — Clear completed removes only completed todos
- **Test Code:** [TC008_Clear_completed_removes_only_completed_todos.py](./TC008_Clear_completed_removes_only_completed_todos.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `clearCompleted()` called `DELETE /api/todos/{id}` for each completed item in parallel. Active todo remained. Completed todo confirmed removed from DOM and DB.

---

#### Test TC012 — Clear completed removes multiple completed todos at once
- **Test Code:** [TC012_Clear_completed_removes_multiple_completed_todos_at_once.py](./TC012_Clear_completed_removes_multiple_completed_todos_at_once.py)
- **Status:** ✅ Passed
- **Severity:** HIGH
- **Analysis / Findings:** `Promise.all()` fired parallel DELETE requests for both completed items. Both confirmed absent from DOM after the operation. No active todos were affected.

---

## 3️⃣ Coverage & Matching Metrics

- **100% of tests passed** (15 / 15)

| Requirement                        | Total Tests | ✅ Passed | ❌ Failed |
|------------------------------------|-------------|-----------|-----------|
| User Onboarding & Registration     | 2           | 2         | 0         |
| User Authentication (Login/Logout) | 2           | 2         | 0         |
| View Todo List                     | 1           | 1         | 0         |
| Add Todo                           | 1           | 1         | 0         |
| Edit Todo Title                    | 2           | 2         | 0         |
| Toggle Todo Completion             | 1           | 1         | 0         |
| Delete Todo                        | 1           | 1         | 0         |
| Filter Todos                       | 3           | 3         | 0         |
| Clear Completed Todos              | 2           | 2         | 0         |
| **Total**                          | **15**      | **15**    | **0**     |

---

## 4️⃣ Key Gaps / Risks

**All 15 tests passed.** Issues below are from static analysis and coverage gaps, not test failures.

### Coverage gaps (TC016–TC032 — not yet executed)
Test cases TC016–TC032 were added to the test plan but test code has not been generated yet. These cover:
- Empty state for new users (TC016)
- Delete without affecting sibling todos (TC017)
- "Clear completed" button visibility toggle (TC018)
- Un-toggle completed → active (TC019)
- Clear completed leaves active todos (TC020)
- Clear completed button disappears after use (TC021)
- Invalid login error message (TC022)
- Cancel inline edit via Escape (TC023)
- Duplicate email registration error (TC024)
- Empty todo title blocked (TC025)
- Minimum password length validation (TC026)
- Unauthenticated redirect to /login (TC027)
- Authenticated redirect away from /login (TC028)
- Items-left counter decrements (TC029, TC030)
- Header shows user name (TC031)
- Whitespace-only edit preserves title (TC032)

### Security observations (static analysis)
- `JWT_SECRET` in `.env.local` is still the placeholder value — must be replaced with a cryptographically random string before any shared or production deployment.
- MySQL password is empty — acceptable for local XAMPP dev, must be secured for any shared environment.
- No rate-limiting on `POST /api/auth/login` or `POST /api/auth/register` — brute-force and account enumeration are possible.

### UX / test reliability note
- The delete ✕ button uses `opacity-0 group-hover:opacity-100` — automated test runners must explicitly call `hover()` before attempting to click it, otherwise the element is non-interactive.
