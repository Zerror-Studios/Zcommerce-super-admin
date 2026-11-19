/**
 * Support (backend PRD-036 R2-8 and PRD-049 step A1, platform-admin subgraph): every store's tickets, the thread
 * with internal notes, assign / status / priority / resolve, the KPI band, Support › Settings, release notes for the
 * stores' What's new, and tickets per topic.
 *
 * PRD-049 FR-A34: ticket reads and the settings need platform:support:read; replies, notes, status, resolve and
 * assigning yourself platform:support:reply; priority, assigning anyone else and saving the settings
 * platform:support:manage. Release notes, topic counts and system health keep platform:tenants:read / :manage.
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
    type
    typeLabel
    topic
    topicLabel
    title
    impact
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
    outcome
    outcomeLabel
    resolvedAt
    closedAt
    closedBy
    reopenedCount
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
    steps
    neededBy
    linkedCustomer {
      id
      label
    }
    followUpOf {
      id
      label
    }
    contact {
      name
      email
      phone
      role
      whatsappOk
      bestTime
    }
    context {
      pageUrl
      browser
      os
      screen
      appVersion
      plan
      recentErrors
    }
    outcomeNote
    resolvedByName
    rating {
      score
      comment
    }
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

/** One view of the queue (the reply due soonest first; Closed newest first) with every view's count (PRD-049 FR-A32). */
export const PLATFORM_SUPPORT_TICKETS = gql`
  query PlatformSupportTickets($tab: PlatformSupportTab, $search: String, $limit: Int, $offset: Int) {
    platformSupportTickets(tab: $tab, search: $search, limit: $limit, offset: $offset) {
      items {
        ...PlatformSupportTicketFields
      }
      totalCount
      counts {
        open
        unassigned
        mine
        urgent
        dueSoon
        waitingOnStore
        resolved
        closed
        all
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
      resolvedAwaitingConfirmation
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
  mutation SetPlatformSupportTicketPriority($id: ID!, $priority: PlatformSupportPriority!, $note: String) {
    setPlatformSupportTicketPriority(id: $id, priority: $priority, note: $note) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

/** PRD-049 FR-A13: resolve with an outcome and a note (posted to the store's thread); the store confirms or reopens. */
export const RESOLVE_PLATFORM_SUPPORT_TICKET = gql`
  mutation ResolvePlatformSupportTicket($id: ID!, $input: PlatformSupportResolveInput!) {
    resolvePlatformSupportTicket(id: $id, input: $input) {
      ...PlatformSupportTicketFields
      ...PlatformSupportThreadFields
    }
  }
  ${TICKET_FIELDS}
  ${THREAD_FIELDS}
`;

// ─── Support › Settings (PRD-049 FR-A33) ─────────────────────────────────

const SUPPORT_SETTINGS_FIELDS = gql`
  fragment PlatformSupportSettingsFields on PlatformSupportSettings {
    calendar {
      timezone
      weekly {
        open
        close
      }
      holidays
    }
    firstReplyHours {
      URGENT
      HIGH
      NORMAL
      LOW
    }
    reopenReplyHours
    autoCloseDays
    reminderDays
    reopenDays
    waitingReminderWorkingDays
    version
    updatedAt
  }
`;

export const PLATFORM_SUPPORT_SETTINGS = gql`
  query PlatformSupportSettings {
    platformSupportSettings {
      ...PlatformSupportSettingsFields
    }
  }
  ${SUPPORT_SETTINGS_FIELDS}
`;

/** Omitted fields keep their value; `expectedVersion` answers CONFLICT VERSION_CONFLICT when someone saved first. */
export const UPDATE_PLATFORM_SUPPORT_SETTINGS = gql`
  mutation UpdatePlatformSupportSettings($input: PlatformSupportSettingsInput!) {
    updatePlatformSupportSettings(input: $input) {
      ...PlatformSupportSettingsFields
    }
  }
  ${SUPPORT_SETTINGS_FIELDS}
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
