# Reading Lists - Cell Reference Guide

This document outlines which spreadsheet cells are being pulled for each reading list feature.

## Spreadsheet Structure

All reading data is pulled from Google Sheets. The main spreadsheet URL pattern:
`https://docs.google.com/spreadsheets/d/e/2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/pub?gid={SHEET_GID}&single=true&output=csv`

## Feature Breakdown

### 1. Currently Reading
**Sheet:** Recents (GID: `1869146893`)  
**Function:** `getBookData()` in `homepage-backend/functions/index.js`

**Cells Pulled:**
- **Status:** Column N (index 13) - Looks for "In progress"
- **Title:** Column K (index 10)
- **Author:** Column L (index 11)
- **Range:** Starting from row 25 (0-indexed = 24) up to row 500

**How it works:**
- Scans rows 25-500 looking for "In progress" in column N
- When found, extracts title from column K and author from column L
- Displays in the "currently" section of the homepage

---

### 2. Recent Favs
**Sheet:** Recents (GID: `1869146893`)  
**Function:** `getFavoriteReads()` in `homepage-backend/functions/index.js`

**Cells Pulled:**
- **Recent Reads:** Rows 1-10 (C1:G10)
  - Column C (index 2) = Rating
  - Column D (index 3) = Title
  - Column E (index 4) = Author
  - Column F (index 5) = Summary
  - Column G (index 6) = Genre

- **Reading Stats:** Row 18, Column A (A18)
  - Format: "NF: Y | F: Z" (Non-fiction count | Fiction count)

**How it works:**
- Pulls up to 10 books from rows 1-10
- Stops when it hits an empty title
- Displays in "recent favs" navigation option

---

### 3. Last Five Years Favs
**Sheet:** Recents (GID: `1869146893`)  
**Function:** `getFavoriteReads()` in `homepage-backend/functions/index.js`

**Cells Pulled:**
- **Last Five Years Reads:** Rows 52-62 (C52:G62)
  - Column C (index 2) = Rating
  - Column D (index 3) = Title
  - Column E (index 4) = Author
  - Column F (index 5) = Summary
  - Column G (index 6) = Genre

**How it works:**
- Pulls books from rows 52-62
- Stops when it hits an empty title
- Displays in "last five years favs" navigation option

---

### 4. Annual Reading Lists (2021, 2022, 2023, 2024, 2025)
**Sheets:** Individual year sheets (by GID)  
**Function:** `getAnnualReadingLists()` in `homepage-backend/functions/index.js`

**Sheet GIDs:**
- 2025: `2110174287`
- 2024: `82205515`
- 2023: `1354905140`
- 2022: `0`
- 2021: `1481213422`

**Cell Structures by Year:**

#### 2025 Structure:
- Column A = Year
- Column B = Month
- Column C = Rating
- Column D = Title
- Column E = Author
- Column G = Genre (fiction/non-fiction)

#### 2024 Structure:
- Column B = Month
- Column C = Rating
- Column D = Title
- Column E = Author
- Column G = Genre (fiction/non-fiction)

#### 2023 Structure:
- Column A = Month
- Column B = Rating
- Column C = Title
- Column D = Author
- Column F = Genre (fiction/non-fiction)

#### 2022 Structure:
- Column A = Rating
- Column B = Title
- Column C = Author
- Column E = Genre (fiction/non-fiction)

#### 2021 Structure:
- Column A = Title
- Column B = Author
- Column C = Genre (fiction/non-fiction)
- Column D = Rating

**How it works:**
- Each year sheet is parsed separately
- Books are grouped into "fiction" and "non-fiction" lists
- Displayed in annual navigation (2025, 2024, 2023, etc.)
- Shows paginated lists with 12 books per page

---

### 5. This Year (2026)
**Sheet:** 2026 Sheet (GID: `393005093`)  
**Function:** `getThisYearReads()` in `homepage-backend/functions/index.js`

**Cells Pulled:**
- **Range:** I24:N90 (rows 24-90)
  - Column I (index 8) = Month number (1-12)
  - Column K (index 10) = Title
  - Column L (index 11) = Author
  - Column N (index 13) = Status (must be "Completed", "completed", "complete", "✓", or "done")

**How it works:**
- Pulls completed books from rows 24-90
- Groups by month (january through december)
- Only includes books with completed status
- Displays in monthly format in "this year" navigation option
- Shows most recent months first

---

## Action Items

✅ **All GIDs have been configured:**
- 2025 Sheet GID: `2110174287` ✓
- 2026 Sheet GID: `393005093` ✓

### How to Find a Sheet's GID

1. Open the Google Sheet
2. Click on the specific sheet tab you want
3. Look at the URL in your browser
4. Find the part that says `#gid=XXXXX`
5. The number after `gid=` is the GID you need

Example URL:
```
https://docs.google.com/spreadsheets/d/.../edit#gid=82205515
                                                              ^^^^^^^^
                                                              This is the GID
```

---

## Summary Table

| Feature | Sheet | GID | Range | Key Columns |
|---------|-------|-----|-------|-------------|
| Currently Reading | Recents | 1869146893 | Rows 25-500 | N=Status, K=Title, L=Author |
| Recent Favs | Recents | 1869146893 | C1:G10 | C=Rating, D=Title, E=Author, F=Summary, G=Genre |
| Last Five Years Favs | Recents | 1869146893 | C52:G62 | C=Rating, D=Title, E=Author, F=Summary, G=Genre |
| 2025 Annual Lists | 2025 | 2110174287 | All rows | See 2025 structure above |
| 2024 Annual Lists | 2024 | 82205515 | All rows | See 2024 structure above |
| 2023 Annual Lists | 2023 | 1354905140 | All rows | See 2023 structure above |
| 2022 Annual Lists | 2022 | 0 | All rows | See 2022 structure above |
| 2021 Annual Lists | 2021 | 1481213422 | All rows | See 2021 structure above |
| This Year (2026) | 2026 | 393005093 | I24:N90 | I=Month, K=Title, L=Author, N=Status |

---

## Testing Checklist

After updating the GIDs, verify:

- [ ] Currently reading shows the correct book from recents sheet
- [ ] Recent favs displays books from C1:G10
- [ ] Last five years favs displays books from C52:G62
- [ ] 2025 appears in navigation and shows fiction/non-fiction lists
- [ ] 2024, 2023, etc. still work correctly
- [ ] "This year" shows books from 2026 sheet (should include "the 11th hour" if completed)
- [ ] All navigation switches work correctly

