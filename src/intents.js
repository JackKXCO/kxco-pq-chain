/**
 * Relay intent builder + signer.
 *
 * Every relay request is a signed JSON intent that proves the institution
 * authorised the operation. The relay validates the ML-DSA-65 signature
 * off-chain before submitting the EVM transaction.
 *
 * Signing message format (newline-delimited, UTF-8):
 *
 *   kxco-relay-v1
 *   operation: <name>
 *   institutionKid: <16-hex-char kid>
 *   nonce: <64 random hex chars>
 *   timestamp: <unix seconds>
 *   payload: <JCS-canonical JSON of the payload object>
 *
 * Replay protection: the relay rejects requests where timestamp is outside
 * ±5 minutes of server time, or where the nonce has been seen before.
 */

import { canonicalize } from './jcs.js'

const enc = new TextEncoder()

/**
 * Build the signing message for a relay intent.
 * @param {string} operation
 * @param {string} institutionKid
 * @param {string} nonce          — 64 random hex chars
 * @param {number} timestamp      — unix seconds
 * @param {object} payload
 * @returns {Uint8Array}
 */
export function buildSigningMessage(operation, institutionKid, nonce, timestamp, payload) {
  return enc.encode([
    'kxco-relay-v1',
    `operation: ${operation}`,
    `institutionKid: ${institutionKid}`,
    `nonce: ${nonce}`,
    `timestamp: ${timestamp}`,
    `payload: ${canonicalize(payload)}`,
  ].join('\n'))
}

/**
 * Generate a cryptographically random 64-hex-char nonce.
 * Node 20+ exposes globalThis.crypto; earlier versions use node:crypto.
 * @returns {string}
 */
export function randomNonce() {
  const bytes = new Uint8Array(32)
  // globalThis.crypto is available in Node 20+ and all modern browsers
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('hex')
}

/**
 * Build and sign a relay intent payload.
 *
 * @param {object} opts
 * @param {string} opts.operation
 * @param {string} opts.institutionKid
 * @param {object} opts.payload
 * @param {object} opts.identity   — KxcoIdentity (must have .kid and .sign())
 * @returns {Promise<object>}      — the complete signed intent object
 */
export async function buildIntent({ operation, institutionKid, payload, identity }) {
  const nonce     = randomNonce()
  const timestamp = Math.floor(Date.now() / 1000)
  const message   = buildSigningMessage(operation, institutionKid, nonce, timestamp, payload)
  const sigBytes  = await identity.sign(message)
  const signature = Buffer.from(sigBytes).toString('hex')

  return {
    operation,
    institutionKid,
    nonce,
    timestamp,
    payload,
    signature,
  }
}
