/**
 * Support (backend PRD-036 R2-8, platform-admin subgraph): every store's tickets, the thread with internal notes,
 * assign / status / priority, the KPI band, release notes for the stores' What's new, and tickets per topic.
 *
 * Reads need platform:tenants:read; replies, notes, assign, status and priority platform:notes:write; release notes
 * platform:tenants:manage.
 */

import { gql } from "@apollo/client";

// ─── Tickets ──────────────────────────────────────────────────────────────

const TICKET_FIELDS = gql`
  fragment PlatformSupportTicketFields on PlatformSupportTicket {
    id
    ref
    tenantId
    storeName
    storeSlug
    topic
    topicLabel
    title
    priority
    priorityAuto
    status
    trackerStep
    expectedResolution
    replyTargetHours
    raisedByName
    raisedByEmail
    raisedViaImpersonation
    assignee {
      id
      name
    }
    replyDueAt
    firstReplyAt
    solvedAt
    quickReplies
    messageCount
    attachmentCount
    lastMessageAt
    lastMessageBy
    createdAt
    updatedAt
  }
`;

const THREAD_FIELDS = gql`
  fragment PlatformSupportThreadFields on PlatformSupportTicket {
    description
    linkedOrder {
      id
      label
    }
    linkedProduct {
      id
      label
    }
    statusHistory {
      status
      at
      byType
    }
    messages {
      id
      authorType
      authorName
      body
      attachments {
        url
        name
        contentType
        size
      }
      internal
      quickReplies
      createdAt
    }
  }
`;

/** One tab of the queue (the reply due soonest first; Solved newest first) with the tab counts. */
export const PLATFORM_SUPPORT_TICKETS = gql`
  query PlatformSupportTickets($tab: PlatformSupportTab, $search: String, $limit: Int, $offset: Int) {
    platformSupportTickets(tab: $tab, search: $search, limit: $limit, offset: $offset) {
      items {
        ...PlatformSupportTicketFields
      }
      totalCount
      counts {
        open
        waitingOnStore
        solved
        mine
      }
    }
  }
  ${TICKET_FIELDS}
`;

/** Board 45's KPI band. */
export const PLATFORM_SUPPORT_SUMMARY = gql`
  query PlatformSupportSummary {
    platformSupportSummary {
      open
      openHighPriority
      overdue
      waitingOnStore
      waitingStoreNames
      solvedThisWeek
      firstReplyMedianMinutes
      firstReplyCountThisWeek
      replyTargetHours {
        URGENT
        HIGH
        NORMAL
        LOW
      }
    }
  }
`;

export const PLATFORM_SUPPORT_TICKET = gql`
  query PlatformSupportTicket($id: ID!) {
    platformSupportTicket(id: $id) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

export const PLATFORM_SUPPORT_ASSIGNEES = gql`
  query PlatformSupportAssignees {
    platformSupportAssignees {
      id
      name
      email
    }
  }
`;

export const REPLY_PLATFORM_SUPPORT_TICKET = gql`
  mutation ReplyPlatformSupportTicket($id: ID!, $input: PlatformSupportReplyInput!) {
    replyPlatformSupportTicket(id: $id, input: $input) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

export const ADD_PLATFORM_SUPPORT_NOTE = gql`
  mutation AddPlatformSupportNote($id: ID!, $input: PlatformSupportNoteInput!) {
    addPlatformSupportNote(id: $id, input: $input) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

export const ASSIGN_PLATFORM_SUPPORT_TICKET = gql`
  mutation AssignPlatformSupportTicket($id: ID!, $assigneeId: ID) {
    assignPlatformSupportTicket(id: $id, assigneeId: $assigneeId) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

export const SET_PLATFORM_SUPPORT_TICKET_STATUS = gql`
  mutation SetPlatformSupportTicketStatus($id: ID!, $status: PlatformSupportStatus!) {
    setPlatformSupportTicketStatus(id: $id, status: $status) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

export const SET_PLATFORM_SUPPORT_TICKET_PRIORITY = gql`
  mutation SetPlatformSupportTicketPriority($id: ID!, $priority: PlatformSupportPriority!) {
    setPlatformSupportTicketPriority(id: $id, priority: $priority) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

/** Guides & videos: what stores raise tickets about. */
export const PLATFORM_SUPPORT_TOPIC_COUNTS = gql`
  query PlatformSupportTopicCounts($days: Int) {
    platformSupportTopicCounts(days: $days) {
      topic
      label
      count
      open
    }
  }
`;

// ─── Release notes (the stores' What's new) ───────────────────────────────

const RELEASE_NOTE_FIELDS = gql`
  fragment PlatformReleaseNoteFields on PlatformReleaseNote {
    id
    version
    title
    releasedAt
    bullets
    screenshotUrl
    status
    updatedAt
  }
`;

export const PLATFORM_RELEASE_NOTES = gql`
  query PlatformReleaseNotes {
    platformReleaseNotes {
      ...PlatformReleaseNoteFields
    }
  }
  ${RELEASE_NOTE_FIELDS}
`;

export const CREATE_PLATFORM_RELEASE_NOTE = gql`
  mutation CreatePlatformReleaseNote($input: PlatformReleaseNoteInput!) {
    createPlatformReleaseNote(input: $input) {
      ...PlatformReleaseNoteFields
    }
  }
  ${RELEASE_NOTE_FIELDS}
`;

export const UPDATE_PLATFORM_RELEASE_NOTE = gql`
  mutation UpdatePlatformReleaseNote($id: ID!, $input: PlatformReleaseNoteInput!) {
    updatePlatformReleaseNote(id: $id, input: $input) {
      ...PlatformReleaseNoteFields
    }
  }
  ${RELEASE_NOTE_FIELDS}
`;

export const DELETE_PLATFORM_RELEASE_NOTE = gql`
  mutation DeletePlatformReleaseNote($id: ID!) {
    deletePlatformReleaseNote(id: $id)
  }
`;
