# Tasks: remaining-dashboard-pages

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,200-3,300 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Batch 1 → Batch 2 → Batch 3 → Batch 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | friends, notifications, not-found, error | PR 1 | Critical pages for navigation |
| 2 | user-search, pairs | PR 2 | Core navigation + friend system |
| 3 | profile-page, shop-page | PR 3 | User experience pages |
| 4 | tournaments-page, tournament-detail, tournament-create | PR 4 | Tournament system completion |

## Phase 1: Foundation (Batch 1)

- [x] 1.1 Create `packages/frontend/src/app/(dashboard)/friends/page.tsx` with Friends page implementation
- [x] 1.2 Create `packages/frontend/src/app/(dashboard)/notifications/page.tsx` with Notification center
- [x] 1.3 Create `packages/frontend/src/app/not-found.tsx` with global 404 page
- [x] 1.4 Create `packages/frontend/src/app/error.tsx` with client error boundary

## Phase 2: Core Navigation (Batch 2)

- [x] 2.1 Create `packages/frontend/src/app/(dashboard)/users/search/page.tsx` with player search
- [x] 2.2 Create `packages/frontend/src/app/(dashboard)/pairs/page.tsx` with pair management

## Phase 3: User Experience (Batch 3)

- [x] 3.1 Create `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` with public profile
- [x] 3.2 Create `packages/frontend/src/app/(dashboard)/shop/page.tsx` with coin shop

## Phase 4: Tournament System (Batch 4)

- [x] 4.1 Create `packages/frontend/src/app/(dashboard)/tournaments/page.tsx` with tournament list
- [x] 4.2 Create `packages/frontend/src/app/(dashboard)/tournaments/[id]/page.tsx` with detail and bracket
- [x] 4.3 Create `packages/frontend/src/app/(dashboard)/tournaments/create/page.tsx` with tournament form

## Implementation Order

Recommended batch order (stacked-to-main) to maintain build health and review focus:
1. Batch 1: friends, notifications, not-found, error (critical navigation components)
2. Batch 2: user-search, pairs (core navigation and friend system)
3. Batch 3: profile, shop (user experience pages)
4. Batch 4: tournaments (feature completion)

Each batch builds on previous ones and can be deployed independently while maintaining site functionality.

## Review Workload Forecast
- Estimated changed lines: 2,200-3,300 lines (11 pages × 200-300 lines)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Delivery strategy: ask-on-risk
- Decision needed before apply: Yes
- Suggested work-unit PR split: Batch 1 → Batch 2 → Batch 3 → Batch 4 (4 PRs to guard review focus)