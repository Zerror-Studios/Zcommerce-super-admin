/**
 * Support › Feature requests (backend PRD-049 step A3, FR-A29, D13;
 * platform-admin subgraph): the board with store names and ups / downs, one
 * request with its voting stores, down-vote reasons, votes by plan, the
 * up-voters' plan value and every comment, and the moderation mutations.
 *
 * Reads need platform:support:read or platform:feedback:manage; every
 * mutation needs platform:feedback:manage.
 */

import { gql } from "@apollo/client";

// ─── Fragments ────────────────────────────────────────────────────────────

const FEATURE_REQUEST_FIELDS = gql`
  fragment PlatformFeatureRequestFields on PlatformFeatureRequest {
    id
    ref
    title
    type
    typeLabel
    area
    areaLabel
    problem
    status
    statusLabel
    statusNote
    releaseUrl
    statusChangedAt
    storeId
    storeName
    storeSlug
    createdByName
    upVotes
    downVotes
    score
    commentCount
    hidden
    mergedIntoId
    lastActivityAt
    createdAt
    updatedAt
  }
`;

const FEATURE_COMMENT_FIELDS = gql`
  fragment PlatformFeatureCommentFields on PlatformFeatureComment {
    id
    body
    authorName
    fromZerror
    storeName
    pinned
    hidden
    createdAt
  }
`;

const FEATURE_REQUEST_DETAIL_FIELDS = gql`
  fragment PlatformFeatureRequestDetailFields on PlatformFeatureRequestDetail {
    id
    ref
    title
    type
    typeLabel
    area
    areaLabel
    problem
    status
    statusLabel
    statusNote
    releaseUrl
    statusChangedAt
    storeId
    storeName
    storeSlug
    createdByName
    upVotes
    downVotes
    score
    commentCount
    hidden
    mergedIntoId
    lastActivityAt
    createdAt
    updatedAt
    votes {
      storeId
      storeName
      storeSlug
      planName
      vote
      reason
      votedByName
      votedAt
    }
    votesByPlan {
      plan
      up
      down
    }
    upVoterMonthlyValue
    currency
    comments {
      ...PlatformFeatureCommentFields
    }
  }
  ${FEATURE_COMMENT_FIELDS}
`;

// ─── Queries ──────────────────────────────────────────────────────────────

/** Merged requests only with status MERGED; hidden ones only with includeHidden. */
export const PLATFORM_FEATURE_REQUESTS = gql`
  query PlatformFeatureRequests(
    $sort: PlatformFeatureSort
    $status: PlatformFeatureStatus
    $area: String
    $type: PlatformFeatureType
    $search: String
    $includeHidden: Boolean
    $limit: Int
    $offset: Int
  ) {
    platformFeatureRequests(
      sort: $sort
      status: $status
      area: $area
      type: $type
      search: $search
      includeHidden: $includeHidden
      limit: $limit
      offset: $offset
    ) {
      items {
        ...PlatformFeatureRequestFields
      }
      totalCount
      counts {
        status
        label
        count
      }
    }
  }
  ${FEATURE_REQUEST_FIELDS}
`;

export const PLATFORM_FEATURE_REQUEST = gql`
  query PlatformFeatureRequest($id: ID!) {
    platformFeatureRequest(id: $id) {
      ...PlatformFeatureRequestDetailFields
    }
  }
  ${FEATURE_REQUEST_DETAIL_FIELDS}
`;

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * NOT_PLANNED needs a note (NOTE_REQUIRED); a release link must be https
 * (INVALID_URL). Planned, In progress, Released and Not planned tell every
 * store that posted or voted.
 */
export const SET_FEATURE_REQUEST_STATUS = gql`
  mutation SetFeatureRequestStatus(
    $id: ID!
    $input: PlatformFeatureStatusInput!
  ) {
    setFeatureRequestStatus(id: $id, input: $input) {
      ...PlatformFeatureRequestFields
    }
  }
  ${FEATURE_REQUEST_FIELDS}
`;

/** Votes move to the target, one per store (the target's wins). */
export const MERGE_FEATURE_REQUESTS = gql`
  mutation MergeFeatureRequests($sourceId: ID!, $targetId: ID!) {
    mergeFeatureRequests(sourceId: $sourceId, targetId: $targetId) {
      ...PlatformFeatureRequestDetailFields
    }
  }
  ${FEATURE_REQUEST_DETAIL_FIELDS}
`;

export const EDIT_FEATURE_REQUEST = gql`
  mutation EditFeatureRequest($id: ID!, $input: PlatformFeatureEditInput!) {
    editFeatureRequest(id: $id, input: $input) {
      ...PlatformFeatureRequestFields
    }
  }
  ${FEATURE_REQUEST_FIELDS}
`;

export const HIDE_FEATURE_REQUEST = gql`
  mutation HideFeatureRequest($id: ID!, $hidden: Boolean!) {
    hideFeatureRequest(id: $id, hidden: $hidden) {
      ...PlatformFeatureRequestFields
    }
  }
  ${FEATURE_REQUEST_FIELDS}
`;

/** Every store sees it, badged "ZCommerce team". */
export const REPLY_FEATURE_REQUEST = gql`
  mutation ReplyFeatureRequest($id: ID!, $input: PlatformFeatureReplyInput!) {
    replyFeatureRequest(id: $id, input: $input) {
      ...PlatformFeatureCommentFields
    }
  }
  ${FEATURE_COMMENT_FIELDS}
`;

/** Pin a ZCommerce reply (NOT_ZERROR_REPLY otherwise) or hide any comment. */
export const UPDATE_FEATURE_COMMENT = gql`
  mutation UpdateFeatureComment(
    $id: ID!
    $input: PlatformFeatureCommentInput!
  ) {
    updateFeatureComment(id: $id, input: $input) {
      ...PlatformFeatureCommentFields
    }
  }
  ${FEATURE_COMMENT_FIELDS}
`;
