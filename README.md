# CPD Centre Finder

Applicants pick their region and district to see the proposed National CPD training centres.
Admins upload the spreadsheet at `/admin`. Uploading it again updates the list without duplicates.

## How updates work

- Each row in the spreadsheet is one officer's proposal. A row is identified by the officer's
  **phone number** (`0244…`, `244…` and `+233 24…` count as the same number). Rows with no
  phone number are matched by name within the district.
- Uploading a file shows a preview first (new, updated, unchanged and not-in-file counts).
  Nothing is saved until you click **Apply update**.
- Rows not in the new file are removed only when the "Remove … not in this file" box is ticked.
  Untick it to upload a file that holds only new or changed rows.
- If the same officer appears twice in one file, the last row wins.
- The public page lists each district's centres once. Spelling variants are merged
  (`CHURCH, AGOGO` / `CHURCH,AGOGO`), and so are shorter forms of the same name
  (`MERCY BAPTIST` / `MERCY BAPTIST CHURCH`). Placeholder answers such as `YES`, `N/A` and `300` are hidden.
- Officers' names and phone numbers are visible only in the admin area, never on the public page.
- **Download current list (CSV)** in the admin area exports what is live. Edit it in Excel
  and upload it again.

Accepted files are `.xlsx` and `.csv`. Old `.xls` files must be saved as `.xlsx` first. The header
row can sit below a title row. Required columns are Region, District and at least one proposed centre.

## Deploy on Vercel (free Hobby plan)

1. Push this folder to GitHub and import the repository at vercel.com/new. The framework is detected as Next.js.
2. In the project, open **Storage → Create Database → Neon (Postgres)** and pick the free plan.
   Connect it to the project. This adds `DATABASE_URL` automatically.
3. Under **Settings → Environment Variables**, add:
   - `ADMIN_PASSWORD`: the admin login password
   - `SESSION_SECRET`: any long random string
4. Redeploy. Open `/admin`, sign in and upload the spreadsheet.

The tables are created on first use. The public page is served from Vercel's cache and rebuilt
right after each upload, so applicant traffic never touches the database.

## Local development

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD and SESSION_SECRET
npm run dev                  # http://localhost:3000
npm test
```

Without `DATABASE_URL`, the app uses an embedded Postgres stored in `.data/`, so no database
server is needed locally.
