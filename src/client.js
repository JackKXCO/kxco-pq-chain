/**
 * KxcoChain — HTTP client for the KXCO meta-transaction relay.
 *
 * Institutions never interact with Armature L1 directly. This client
 * sends ML-DSA-65 signed intents to the KXCO relay, which validates
 * the signature and submits the EVM transaction on the institution's behalf.
 *
 * All six operations return { txHash, blockNumber } on success and throw
 * KxcoChainError on failure.
 */

import { buildIntent } from './intents.js'
import { KxcoChainError } from './errors.js'

export class KxcoChain {
  #relay
  #identity
  #timeout

  /**
   * @param {object} opts
   * @param {string} opts.relay     — relay base URL, e.g. 'https://relay.kxco.ai'
   * @param {object} opts.identity  — KxcoIdentity from kxco-pq-sdk (must have .kid and .sign())
   * @param {number} [opts.timeout] — request timeout in ms (default 10000)
   */
  constructor({ relay, identity, timeout = 10_000 }) {
    if (!relay)    throw new KxcoChainError('relay URL is required',    { code: 'BAD_CONFIG' })
    if (!identity) throw new KxcoChainError('identity is required',     { code: 'BAD_CONFIG' })
    this.#relay    = relay.replace(/\/$/, '')
    this.#identity = identity
    this.#timeout  = timeout
  }

  // ─── operations ──────────────────────────────────────────────────────────

  /**
   * Register an institution on-chain. Called once during institution onboarding.
   * @param {object} opts
   * @param {string} opts.publicKeyHex  — hex-encoded 1952-byte ML-DSA-65 public key
   * @param {string} [opts.metadataUrl] — URL of institution metadata JSON
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async registerInstitution({ publicKeyHex, metadataUrl = '' }) {
    return this.#send('registerInstitution', {
      publicKeyHex,
      metadataUrl,
    })
  }

  /**
   * Record a user credential issuance on-chain.
   * @param {object} opts
   * @param {string} opts.userKid         — 16-hex-char kid of the issued user
   * @param {string} opts.userPublicKeyHex — hex-encoded user ML-DSA-65 public key
   * @param {string} opts.role            — role string (e.g. 'verified-user')
   * @param {number} [opts.expiresAt]     — unix seconds; omit or 0 = no expiry
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async issueCredential({ userKid, userPublicKeyHex, role, expiresAt = 0 }) {
    return this.#send('issueCredential', {
      userKid,
      userPublicKeyHex,
      role,
      expiresAt,
    })
  }

  /**
   * Revoke a user credential on-chain.
   * @param {object} opts
   * @param {string} opts.userKid       — kid of the user whose credential is revoked
   * @param {string} [opts.reason]      — human-readable revocation reason
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async revokeCredential({ userKid, reason = '' }) {
    return this.#send('revokeCredential', {
      userKid,
      reason,
    })
  }

  /**
   * Anchor an audit log checkpoint on-chain.
   * @param {object} opts
   * @param {string} opts.rootHash    — hex SHA-256 of the latest AuditLog entry hash
   * @param {number} opts.entryCount  — total entries in the log at checkpoint time
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async anchorAuditRoot({ rootHash, entryCount }) {
    return this.#send('anchorAuditRoot', {
      rootHash,
      entryCount,
    })
  }

  /**
   * Anchor a high-value attestation envelope hash on-chain.
   * @param {object} opts
   * @param {string} opts.payloadHash — hex SHA-256 of the signed attestation envelope
   * @param {string} opts.purpose     — purpose string (e.g. 'regulatory-report')
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async anchorAttestation({ payloadHash, purpose }) {
    return this.#send('anchorAttestation', {
      payloadHash,
      purpose,
    })
  }

  /**
   * Record an institution key rotation on-chain.
   * @param {object} opts
   * @param {string} opts.newKid           — new 16-hex-char kid after rotation
   * @param {string} opts.newPublicKeyHex  — hex-encoded new ML-DSA-65 public key
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async rotateKey({ newKid, newPublicKeyHex }) {
    return this.#send('rotateKey', {
      newKid,
      newPublicKeyHex,
    })
  }

  /**
   * Register an AI agent or robot identity on-chain. Called by the sponsoring institution.
   * @param {object} opts
   * @param {string} opts.agentKid           — 16-hex-char kid of the agent
   * @param {string} opts.agentPublicKeyHex  — hex-encoded agent ML-DSA-65 public key
   * @param {string} opts.agentType          — 'llm' | 'robot' | 'iot' | 'process'
   * @param {string} opts.scopeHash          — hex SHA-256 of the canonical scope JSON
   * @param {number} opts.expiresAt          — unix seconds (mandatory, must be > 0)
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async issueAgentCredential({ agentKid, agentPublicKeyHex, agentType, scopeHash, expiresAt }) {
    return this.#send('issueAgentCredential', {
      agentKid,
      agentPublicKeyHex,
      agentType,
      scopeHash,
      expiresAt,
    })
  }

  /**
   * Revoke an agent credential on-chain. The chain identity must be the sponsoring institution.
   * @param {object} opts
   * @param {string} opts.agentKid  — kid of the agent to revoke
   * @param {string} [opts.reason]  — human-readable revocation reason
   * @returns {Promise<{txHash: string, blockNumber: number}>}
   */
  async revokeAgentCredential({ agentKid, reason = '' }) {
    return this.#send('revokeAgentCredential', {
      agentKid,
      reason,
    })
  }

  // ─── internal ────────────────────────────────────────────────────────────

  async #send(operation, payload) {
    const intent = await buildIntent({
      operation,
      institutionKid: this.#identity.kid,
      payload,
      identity: this.#identity,
    })

    const ac  = new AbortController()
    const tid = setTimeout(() => ac.abort(), this.#timeout)

    let response
    try {
      response = await fetch(`${this.#relay}/intents`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(intent),
        signal:  ac.signal,
      })
    } catch (err) {
      clearTimeout(tid)
      if (err.name === 'AbortError') {
        throw new KxcoChainError(`relay request timed out after ${this.#timeout}ms`, { code: 'TIMEOUT' })
      }
      throw new KxcoChainError(`relay request failed: ${err.message}`, { code: 'NETWORK_ERROR' })
    }
    clearTimeout(tid)

    let body
    try {
      body = await response.json()
    } catch {
      throw new KxcoChainError('relay returned non-JSON response', { code: 'PARSE_ERROR', status: response.status })
    }

    if (!response.ok || body.ok === false) {
      throw new KxcoChainError(
        body.error ?? `relay error ${response.status}`,
        { code: body.code ?? 'RELAY_ERROR', status: response.status, body }
      )
    }

    return { txHash: body.txHash, blockNumber: body.blockNumber }
  }
}
