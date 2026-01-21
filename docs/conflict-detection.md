# Conflict Detection Fix Summary

## Problem Statement

The original conflict detection was incorrectly treating files with different HTTP methods as conflicts. For example:

- `stevie.get.ts` (GET /api/examples/stevie)
- `stevie.patch.ts` (PATCH /api/examples/stevie)

These were flagged as conflicts and one would get renamed to `/api/examples/stevie-2`, which is incorrect for REST APIs where different methods on the same URL are valid and expected.

## Root Cause

The conflict detection logic in `src/conflict-detector.ts` was grouping files only by URL:

```typescript
const urlToFiles = new Map<string, string[]>()
for (const route of routes) {
  const existing = urlToFiles.get(route.url) || []
  existing.push(route.filePath)
  urlToFiles.set(route.url, existing)
}
```

This meant any files with the same URL were considered conflicts, regardless of HTTP method.

## Solution

### 1. Smart Suffix Placement

When conflicts are detected, the suffix is now added to the **last non-parameter segment** of the URL, not to the parameter itself:

```
Before: /api/users/:id → /api/users/:id-2  ❌ (still conflicts!)
After:  /api/users/:id → /api/users-2/:id  ✅ (truly unique)
```

This ensures conflicts are actually resolved, since adding `-2` to a parameter name doesn't change the route structure.

### 2. Updated Grouping Logic

Changed to group by **normalized URL + HTTP method**:

```typescript
const urlMethodToFiles = new Map<string, string[]>()
for (const route of routes) {
  const normalizedUrl = normalizeUrlForConflictDetection(route.url)
  const key = `${normalizedUrl}::${route.method}`
  const existing = urlMethodToFiles.get(key) || []
  existing.push(route.filePath)
  urlMethodToFiles.set(key, existing)
}
```

### 3. Added URL Normalization

Created `normalizeUrlForConflictDetection()` function to treat different parameter names as the same:

```typescript
function normalizeUrlForConflictDetection(url: string): string {
  return url.replace(/:[^/]+/g, ':param')
}
```

This ensures:

- `/api/users/:id` and `/api/users/:userId` → both become `/api/users/:param`
- These are treated as conflicts if they have the same HTTP method
- But `/api/users/:id` (GET) and `/api/users/:id` (POST) are NOT conflicts

### 4. Watch Mode Integration

Updated `src/watch.ts` to re-run conflict detection whenever files are added, changed, or deleted:

- On `add`: Scaffolds the file if empty, then runs full conflict detection
- On `change`: Runs full conflict detection to catch manual URL changes
- On `unlink`: Runs conflict detection in case deletion resolved a conflict

## Behavior Changes

### Different Methods (No Conflict)

**Before Fix:**
❌ GET /api/examples/stevie and PATCH /api/examples/stevie → **CONFLICT**
❌ Renaming: PATCH gets `/api/examples/stevie-2`

**After Fix:**
✅ GET /api/examples/stevie and PATCH /api/examples/stevie → **NO CONFLICT**
✅ Both keep `/api/examples/stevie` (valid REST API pattern)

### Same Method with Parameters (Conflict)

**Before Fix:**
❌ GET /api/users/:id and GET /api/users/:userId → **CONFLICT**
❌ Renaming: second gets `/api/users/:userId-2` (still conflicts!)

**After Fix:**
✅ GET /api/users/:id and GET /api/users/:userId → **CONFLICT**
✅ Renaming: second gets `/api/users-2/:userId` (truly unique!)

### Complex Example

**Before:**

```
/api/examples/foobar/:id
/api/examples/foobar/:count-2  ❌ Still conflicts!
```

**After:**

```
/api/examples/foobar/:id
/api/examples/foobar-2/:count  ✅ Different routes!
```

## Test Coverage

- ✅ 24 unit tests in `conflict-detector.test.ts`
- ✅ Test for different methods on same URL (no conflict)
- ✅ Test for parameter normalization (conflict detection)
- ✅ Integration tests updated to reflect new behavior
- ✅ Watch mode conflict detection verified

## Files Modified

1. `src/conflict-detector.ts` - Core logic changes
   - Added parameter normalization
   - Changed grouping to use URL + method
   - Updated warning messages to show relative paths (not absolute)
2. `src/watch.ts` - Added conflict detection to file watcher
3. `src/__tests__/conflict-detector.test.ts` - New test cases
4. `src/__tests__/integration.test.ts` - Updated expectations
5. `src/__tests__/initial-scan.test.ts` - Updated expectations

## Breaking Changes

None - this fixes incorrect behavior to match REST API standards. Applications relying on the buggy behavior (wanting conflicts between different HTTP methods) would need to use a different approach.

## Migration Guide

No migration needed. The fix ensures conflicts are correctly detected:

- Different HTTP methods on same URL: No conflict (correct REST behavior)
- Same HTTP method with different param names: Conflict (correct detection)
- Watch mode now automatically detects conflicts on file changes
