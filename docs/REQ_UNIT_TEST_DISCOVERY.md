# Unit Testing Gap Analysis - Narravo

**Analysis Date:** October 1, 2025  

## Executive Summary

This document identifies gaps in unit test coverage for the Narravo project. While the project has excellent coverage for core business logic (posts, comments, taxonomy) and WordPress import functionality (30+ test files), significant gaps exist in security features, API routes, server actions, and UI components.

**Current Coverage Estimate:** 60-70% (critical path analysis)

---

## 🔴 Critical Priority - Security & Infrastructure

### 2FA Security Module (`src/lib/2fa/`)

- [x] `totp.ts` - TOTP generation and verification *(covered by 2fa-totp.test.ts)*
- [x] `rate-limit.ts` - Rate limiting for 2FA attempts *(covered by 2fa-rate-limit.test.ts)*
- [ ] **`security-activity.ts`** - Security audit trail
  - [ ] Test `logSecurityActivity()` function
  - [ ] Test `getSecurityActivities()` function
  - [ ] Test error handling when logging fails
  - [ ] Test different event types (2fa_enabled, passkey_added, etc.)
- [ ] **`trusted-device.ts`** - Device trust management
  - [ ] Test `createTrustedDevice()` function
  - [ ] Test `verifyTrustedDevice()` function
  - [ ] Test `revokeTrustedDevice()` function
  - [ ] Test `revokeAllTrustedDevices()` function
  - [ ] Test `getTrustedDevices()` function
  - [ ] Test expired device handling
  - [ ] Test token hash validation
- [ ] **`webauthn.ts`** - WebAuthn/Passkey support
  - [ ] Test `generateWebAuthnRegistrationOptions()` function
  - [ ] Test `verifyWebAuthnRegistration()` function
  - [ ] Test `generateWebAuthnAuthenticationOptions()` function
  - [ ] Test `verifyWebAuthnAuthentication()` function
  - [ ] Test credential exclusion logic
  - [ ] Test RP ID and origin validation

### Middleware

- [ ] **`middleware.ts`** (root) - Request flow security
  - [ ] Test authentication checks
  - [ ] Test redirect logic
  - [ ] Test 2FA enforcement
  - [ ] Test admin route protection
  - [ ] Test public route access
  - [ ] Test matcher patterns

### API Routes (`src/app/api/`)

#### Admin Endpoints
- [ ] **`/api/admin/config/global`** - Global config management
  - [ ] Test GET endpoint (retrieve config)
  - [ ] Test POST endpoint (update config)
  - [ ] Test admin authentication
  - [ ] Test validation errors
- [ ] **`/api/admin/config/user`** - User-specific config
  - [ ] Test GET endpoint
  - [ ] Test POST endpoint
  - [ ] Test user authentication
- [ ] **`/api/admin/config/delete`** - Config deletion
  - [ ] Test DELETE endpoint
  - [ ] Test admin-only access
  - [ ] Test cascade effects
- [ ] **`/api/admin/config/invalidate`** - Cache invalidation
  - [ ] Test POST endpoint
  - [ ] Test cache clearing
- [ ] **`/api/admin/export`** - Data export
  - [ ] Test export initiation
  - [ ] Test export formats
  - [ ] Test large dataset handling
- [ ] **`/api/admin/export/[operationId]`** - Export status
  - [ ] Test status polling
  - [ ] Test download endpoint
  - [ ] Test operation cleanup
- [ ] **`/api/admin/restore`** - Data restoration
  - [ ] Test restore validation
  - [ ] Test restore execution
  - [ ] Test rollback on failure
- [ ] **`/api/admin/purge`** - Data purging
  - [ ] Test hard delete confirmation
  - [ ] Test preview mode
  - [ ] Test authorization (covered by purge.test.ts - verify)
- [ ] **`/api/admin/users/anonymize`** - User anonymization
  - [ ] Test anonymization process
  - [ ] Test data retention rules
  - [ ] Test cascade to related records

#### 2FA Endpoints
- [ ] **`/api/2fa/status`** - 2FA status check
  - [ ] Test status retrieval
  - [ ] Test unauthenticated access
- [ ] **`/api/2fa/disable`** - Disable 2FA
  - [ ] Test disable flow
  - [ ] Test verification requirement
  - [ ] Test audit logging
- [ ] **`/api/2fa/totp/init`** - TOTP initialization
  - [ ] Test secret generation
  - [ ] Test QR code generation
  - [ ] Test recovery codes
- [ ] **`/api/2fa/totp/confirm`** - TOTP confirmation
  - [ ] Test code verification
  - [ ] Test activation flow
- [ ] **`/api/2fa/totp/verify`** - TOTP verification
  - [ ] Test login verification
  - [ ] Test rate limiting
  - [ ] Test failed attempts
- [ ] **`/api/2fa/recovery/verify`** - Recovery code verification
  - [ ] Test valid recovery code
  - [ ] Test code consumption
  - [ ] Test invalid codes
- [ ] **`/api/2fa/recovery/regenerate`** - Regenerate recovery codes
  - [ ] Test regeneration flow
  - [ ] Test old code invalidation
- [ ] **`/api/2fa/webauthn/register/options`** - WebAuthn registration options
  - [ ] Test options generation
  - [ ] Test credential exclusion
- [ ] **`/api/2fa/webauthn/register/verify`** - WebAuthn registration verification
  - [ ] Test credential verification
  - [ ] Test credential storage
- [ ] **`/api/2fa/webauthn/authenticate/options`** - WebAuthn auth options
  - [ ] Test challenge generation
  - [ ] Test credential lookup
- [ ] **`/api/2fa/webauthn/authenticate/verify`** - WebAuthn auth verification
  - [ ] Test authentication flow
  - [ ] Test counter validation
- [ ] **`/api/2fa/webauthn/credentials/[id]`** - Credential management
  - [ ] Test credential deletion
  - [ ] Test credential listing
- [ ] **`/api/2fa/webauthn/confirm`** - WebAuthn confirmation
  - [ ] Test confirmation flow
- [ ] **`/api/2fa/trusted-devices`** - Trusted device management
  - [ ] Test device listing
  - [ ] Test device revocation
  - [ ] Test device trust creation

#### Other API Endpoints
- [ ] **`/api/uploads/local`** - Local file uploads
  - [ ] Test file upload validation
  - [ ] Test file type restrictions
  - [ ] Test size limits
  - [ ] Test storage handling
- [ ] **`/api/uploads/banner`** - Banner image uploads
  - [ ] Test banner upload
  - [ ] Test image validation
  - [ ] Test image optimization
- [ ] **`/api/metrics/view`** - View tracking
  - [ ] Test view recording
  - [ ] Test bot detection
  - [ ] Test rate limiting
  - [ ] Test analytics aggregation
- [ ] **`/api/r2/sign`** - S3/R2 signed URLs
  - [ ] Test URL generation
  - [ ] Test authentication
  - [ ] Test expiration handling
- [ ] **`/api/version`** - Version information
  - [ ] Test version endpoint
  - [ ] Test build info
- [ ] **`/api/redirects`** - Redirect management
  - [ ] Test redirect listing
  - [ ] Test redirect creation
  - [ ] Test redirect deletion
- [ ] **`/api/import-jobs`** - Import job management
  - [ ] Test job listing
  - [ ] Test job status
  - [ ] Test job cancellation

---

## 🟡 Medium Priority - Application Logic

### Server Actions (`src/app/actions/`)

- [ ] **`deletePost.ts`** - Post deletion action
  - [ ] Test admin authorization
  - [ ] Test post existence validation
  - [ ] Test successful deletion
  - [ ] Test revalidation triggers
  - [ ] Test error handling
  - [ ] Test cascade to comments/attachments
- [ ] **`import.ts`** - Import job management (301 lines)
  - [ ] Test `startImportJob()` function
  - [ ] Test file validation
  - [ ] Test options parsing
  - [ ] Test temporary file handling
  - [ ] Test job creation
  - [ ] Test error scenarios
  - [ ] Test cleanup on failure
  - [ ] Test concurrent imports
- [ ] **`theme.ts`** - Theme preference action
  - [ ] Test `setTheme()` function
  - [ ] Test cookie setting
  - [ ] Test theme values (light/dark)
  - [ ] Test cookie security attributes

### Admin Functionality

- [ ] **`admin.ts`** - Admin access control
  - [ ] Test `parseAdminAllowlist()` function
  - [ ] Test `isEmailAdmin()` function
  - [ ] Test email normalization
  - [ ] Test whitespace handling
  - [ ] Test case sensitivity

### Component Testing - Critical Paths

#### Authentication Components
- [ ] **`TwoFactorVerification.tsx`** - 2FA verification UI
  - [ ] Test code input validation
  - [ ] Test submission handling
  - [ ] Test error display
  - [ ] Test recovery code toggle
- [ ] **`TwoFactorGuard.tsx`** - 2FA enforcement wrapper
  - [ ] Test guard activation
  - [ ] Test bypass conditions
  - [ ] Test redirection logic
- [ ] **`UserMenu.tsx`** - User menu with auth
  - [ ] Test authenticated state
  - [ ] Test unauthenticated state
  - [ ] Test logout functionality

#### Comment Components
- [ ] **`CommentForm.tsx`** - Comment submission
  - [ ] Test form validation
  - [ ] Test submission handling
  - [ ] Test file uploads
  - [ ] Test markdown preview
  - [ ] Test rate limiting UI
- [ ] **`CommentNode.tsx`** - Individual comment display
  - [ ] Test rendering
  - [ ] Test reply functionality
  - [ ] Test moderation actions
- [ ] **`CommentThread.tsx`** - Comment tree
  - [ ] Test thread rendering
  - [ ] Test nesting limits
  - [ ] Test load more functionality

#### Editor Components
- [ ] **`TiptapEditor.tsx`** - Rich text editor (expand existing coverage)
  - [ ] Test toolbar functionality
  - [ ] Test markdown shortcuts
  - [ ] Test image insertion
  - [ ] Test code blocks
  - [ ] Test link handling
  - [ ] Test video embedding
  - [ ] Test task lists

---

## 🟢 Lower Priority - Supporting Infrastructure

### Utility Libraries

- [ ] **`logger.ts`** - Logging functionality
  - [ ] Test log levels
  - [ ] Test log formatting
  - [ ] Test error logging
  - [ ] Test context inclusion
- [ ] **`frame-src.ts`** - CSP frame-src configuration
  - [ ] Test FRAME_SRC_HOSTS list
  - [ ] Test CSP header generation
  - [ ] Test provider validation

### Database & Migrations

- [ ] **Transaction handling tests**
  - [ ] Test multi-table operations
  - [ ] Test rollback on error
  - [ ] Test isolation levels
- [ ] **Migration testing**
  - [ ] Test migration up/down
  - [ ] Test migration idempotency
  - [ ] Test data integrity during migration

### Component Coverage - Comprehensive

#### Admin Components
- [ ] **`AdminHeader.tsx`** - Admin navigation
- [ ] **`AdminNavbar.tsx`** - Admin navbar
- [ ] **`DashboardActions.tsx`** - Dashboard action buttons
- [ ] **`DeletePostButton.tsx`** - Post deletion button
- [ ] **`ModerationQueue.tsx`** - Comment moderation interface
- [ ] **`ServerDetails.tsx`** - Server information display
- [ ] **Admin subdirectories** (analytics, appearance, config, posts, security, users)

#### Public Components
- [ ] **`ArticleCard.tsx`** - Post card display
- [ ] **`Banner.tsx`** - Banner component
- [ ] **`CodeBlock.tsx`** - Code syntax highlighting
- [ ] **`Header.tsx`** - Site header
- [ ] **`Navbar.tsx`** - Site navigation
- [ ] **`SearchBar.tsx`** - Search interface
- [ ] **`Sidebar.tsx`** - Sidebar component
- [ ] **`ThemeToggle.tsx`** - Theme switcher

#### Post Components
- [ ] **`MorePosts.tsx`** - Related posts
- [ ] **`PostCard.tsx`** - Post preview card
- [ ] **`PostList.tsx`** - Post listing

---

## Testing Strategy

### Patterns to Follow

1. **Unit Tests**: Vitest + mock database (existing pattern)
2. **API Tests**: Next.js API route testing utilities
3. **Component Tests**: React Testing Library (already configured)
4. **Integration Tests**: Consider Playwright for critical flows

### Coverage Targets

- **Security Features**: 80%+ coverage (2FA, auth, middleware)
- **API Endpoints**: 75%+ coverage
- **Business Logic**: 80%+ coverage (posts, comments, taxonomy)
- **UI Components**: 70%+ coverage
- **Overall Project**: 70%+ coverage

### Test File Naming Convention

```
tests/
  ├── [module-name].test.ts          # Unit tests for lib files
  ├── api/
  │   └── [route-path].test.ts       # API route tests
  ├── actions/
  │   └── [action-name].test.ts      # Server action tests
  └── components/
      └── [component-name].test.tsx  # Component tests
```

---

## ⚠️ IMPLEMENTATION REQUIREMENTS ⚠️

**CRITICAL REMINDER FOR ALL TEST IMPLEMENTATIONS:**

When implementing any test from this document, ALL tests MUST meet these non-negotiable requirements:

### ✅ Quality Standards

1. **Tests MUST Build Successfully**
   - Run `pnpm build` - must pass without errors
   - Run `pnpm typecheck` - must pass without TypeScript errors
   - Zero compilation errors allowed

2. **Tests MUST Run Successfully**
   - Run `pnpm test` - all tests must pass
   - No flaky tests - tests must be deterministic
   - Proper test isolation - no side effects between tests

3. **Type Safety Requirements**
   - All variables must have proper TypeScript types
   - No use of `any` type unless absolutely necessary (document why)
   - Mock types must match actual implementation types
   - Use proper type assertions with `satisfies` or `as const` where appropriate

4. **Code Quality Standards**
   - Follow existing test patterns in the codebase
   - Use proper mocking strategies (database, external APIs, etc.)
   - Include descriptive test names that explain what is being tested
   - Add comments for complex test setup or assertions
   - Clean up resources (database, files, timers) after tests

5. **Test Structure**
   - Arrange-Act-Assert pattern
   - One logical assertion per test (prefer multiple focused tests)
   - Use `describe` blocks to group related tests
   - Include both positive and negative test cases

6. **Database Mocking**
   - Follow existing patterns: in-memory SQLite for unit tests
   - Mock external services (Auth.js, S3, email, etc.)
   - Reset database state between tests
   - Use test fixtures for common data patterns

7. **Component Testing Standards**
   - Use React Testing Library (already configured)
   - Test user interactions, not implementation details
   - Use `screen` queries for accessibility
   - Mock Next.js router and other framework features properly

### 🚫 What NOT To Do

- ❌ Do NOT submit tests with TypeScript errors
- ❌ Do NOT submit tests that fail on first run
- ❌ Do NOT use `@ts-ignore` or `@ts-expect-error` without documentation
- ❌ Do NOT leave console.log statements in test code
- ❌ Do NOT skip tests with `.skip()` unless documented with reason
- ❌ Do NOT create tests with external dependencies (real DB, real API calls)
- ❌ Do NOT commit commented-out test code

### ✓ Pre-Submission Checklist

Before marking any test task as complete, verify:

```bash
# 1. Type checking passes
pnpm typecheck

# 2. Tests build successfully
pnpm build

# 3. Tests run and pass
pnpm test

# 4. Specific test file passes
pnpm test path/to/test-file.test.ts

# 5. Watch mode works (for development)
pnpm test:watch
```

### 📝 Documentation Requirements

Each test file should include:

- SPDX license header (see existing tests)
- Brief description of what is being tested
- Setup instructions if complex mocking is required
- Explanation of any non-obvious test scenarios

### Example: Good Test Structure

```typescript
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { functionToTest } from '@/lib/module';

describe('functionToTest', () => {
  beforeEach(() => {
    // Setup: Clear mocks, reset state
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup: Restore mocks, clear resources
    vi.restoreAllMocks();
  });

  describe('successful cases', () => {
    it('should return expected result for valid input', () => {
      // Arrange
      const input = 'test-value';
      const expected = 'expected-result';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('error cases', () => {
    it('should throw error for invalid input', () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      expect(() => functionToTest(invalidInput)).toThrow('Expected error message');
    });
  });
});
```

---

## Progress Tracking

### Summary

- **Total Items Identified**: ~120 test tasks
- **Completed**: 30 ✅
- **In Progress**: 0 🚧
- **Not Started**: ~90 ❌

### By Priority

- **🔴 Critical**: ~50 tasks (2FA, API, Middleware)
- **🟡 Medium**: ~40 tasks (Actions, Admin, Components)
- **🟢 Lower**: ~30 tasks (Utils, Comprehensive coverage)

---

## Notes

- Existing tests show good patterns with mocking and fixtures
- Database tests use in-memory SQLite for speed
- Some API functionality may be partially tested through integration tests
- Component tests should focus on user interactions and accessibility
- Consider adding E2E tests for critical user journeys (login, post creation, commenting)
