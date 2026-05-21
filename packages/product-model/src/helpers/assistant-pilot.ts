export type AssistantReplyKind = 'approved' | 'blocked' | 'unsupported'

export interface AssistantReply {
  readonly kind: AssistantReplyKind
  readonly text: string
}

export interface AssistantReplyOptions {
  readonly intro: string
  readonly details?: readonly string[]
  readonly citations: readonly string[]
  readonly scopeNote: string
  readonly warning?: string | null
}

export function buildAssistantCitation(label: string, source?: string): string {
  return `${label} (${source ?? 'unknown-source'})`
}

export function buildAssistantReply({
  intro,
  details = [],
  citations,
  scopeNote,
  warning,
}: AssistantReplyOptions): string {
  const lines: string[] = [intro]

  if (details.length > 0) {
    lines.push(...details)
  }

  lines.push('')
  lines.push(`Citations: ${citations.join('; ')}.`)
  lines.push(scopeNote)

  if (warning) {
    lines.push('')
    lines.push(warning)
  }

  return lines.join('\n')
}

export function buildBlockedAssistantReply(reason: string, approvedHelp: string, scopeNote: string): AssistantReply {
  return {
    kind: 'blocked',
    text: [
      `I can't answer that in the current pilot because ${reason}.`,
      approvedHelp,
      scopeNote,
    ].join('\n'),
  }
}

export function buildUnsupportedAssistantReply(message: string, hint: string, scopeNote: string): AssistantReply {
  return {
    kind: 'unsupported',
    text: [
      message,
      hint,
      scopeNote,
    ].join('\n'),
  }
}

export function buildMockWarning(sources: readonly (string | undefined)[]): string | null {
  return sources.includes('mock')
    ? 'Source warning: one or more cited panels are running in mock mode, so this answer is demo-only.'
    : null
}
