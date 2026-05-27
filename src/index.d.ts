// ── KxcoChainError ────────────────────────────────────────────────────────────

export class KxcoChainError extends Error {
  name: 'KxcoChainError'
  code: string
  status: number | null
  body: unknown | null
}

// ── Intent types ──────────────────────────────────────────────────────────────

export interface RelayIntent {
  operation:      string
  institutionKid: string
  nonce:          string
  timestamp:      number
  payload:        Record<string, unknown>
  signature:      string
}

export interface RelayResult {
  txHash:      string
  blockNumber: number
}

// ── KxcoChain ─────────────────────────────────────────────────────────────────

export interface KxcoChainOptions {
  relay:      string
  /** KxcoIdentity from kxco-pq-sdk — must have .kid (string) and .sign(Uint8Array) */
  identity:   { kid: string; sign(message: Uint8Array): Promise<Uint8Array> }
  timeout?:   number
}

export interface RegisterInstitutionOpts {
  publicKeyHex:  string
  metadataUrl?:  string
}

export interface IssueCredentialOpts {
  userKid:         string
  userPublicKeyHex: string
  role:            string
  expiresAt?:      number
}

export interface RevokeCredentialOpts {
  userKid: string
  reason?: string
}

export interface AnchorAuditRootOpts {
  rootHash:   string
  entryCount: number
}

export interface AnchorAttestationOpts {
  payloadHash: string
  purpose:     string
}

export interface RotateKeyOpts {
  newKid:          string
  newPublicKeyHex: string
}

export class KxcoChain {
  constructor(opts: KxcoChainOptions)
  registerInstitution(opts: RegisterInstitutionOpts): Promise<RelayResult>
  issueCredential(opts: IssueCredentialOpts):               Promise<RelayResult>
  revokeCredential(opts: RevokeCredentialOpts):             Promise<RelayResult>
  anchorAuditRoot(opts: AnchorAuditRootOpts):               Promise<RelayResult>
  anchorAttestation(opts: AnchorAttestationOpts):           Promise<RelayResult>
  rotateKey(opts: RotateKeyOpts):                           Promise<RelayResult>
  issueAgentCredential(opts: IssueAgentCredentialOpts):     Promise<RelayResult>
  revokeAgentCredential(opts: RevokeAgentCredentialOpts):   Promise<RelayResult>
}

export interface IssueAgentCredentialOpts {
  agentKid:          string
  agentPublicKeyHex: string
  agentType:         'llm' | 'robot' | 'iot' | 'process'
  scopeHash:         string
  expiresAt:         number
}

export interface RevokeAgentCredentialOpts {
  agentKid: string
  reason?:  string
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

export function buildSigningMessage(
  operation:      string,
  institutionKid: string,
  nonce:          string,
  timestamp:      number,
  payload:        Record<string, unknown>,
): Uint8Array

export function randomNonce(): string

export function buildIntent(opts: {
  operation:      string
  institutionKid: string
  payload:        Record<string, unknown>
  identity:       { kid: string; sign(message: Uint8Array): Promise<Uint8Array> }
}): Promise<RelayIntent>

export function canonicalize(value: unknown): string
