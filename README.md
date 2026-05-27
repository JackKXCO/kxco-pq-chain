# kxco-pq-chain

HTTP client for the KXCO meta-transaction relay.

Institutions sign ML-DSA-65 intents with their existing post-quantum identity. KXCO validates the signature, pays gas in ARMR, and submits the EVM transaction on Armature L1. Institutions never hold a wallet or pay gas directly — KXCO bills monthly via invoice.

---

## Install

```bash
npm install kxco-pq-chain
```

## Usage

```js
import { KxcoChain } from 'kxco-pq-chain'

// identity is a KxcoIdentity from kxco-pq-sdk
const chain = new KxcoChain({
  relay:    'https://relay.kxco.ai',
  identity: institutionIdentity,
  timeout:  10_000,   // optional, ms (default 10 000)
})

// Register an institution on-chain (called once during onboarding)
const { txHash, blockNumber } = await chain.registerInstitution({
  publicKeyHex: Buffer.from(identity.publicKey).toString('hex'),
  metadataUrl:  'https://example.com/institution.json',   // optional
})

// Record a credential issuance
await chain.issueCredential({
  userKid:         'aa29f37ab7f4b2cf',
  userPublicKeyHex: Buffer.from(userPublicKey).toString('hex'),
  role:            'verified-user',
  expiresAt:       1800000000,   // unix seconds, optional (0 = no expiry)
})

// Revoke a credential
await chain.revokeCredential({
  userKid: 'aa29f37ab7f4b2cf',
  reason:  'kyc-expired',   // optional
})

// Anchor an audit log checkpoint
await chain.anchorAuditRoot({
  rootHash:   'a3f1...64-hex-chars',
  entryCount: 100,
})

// Anchor an attestation envelope hash
await chain.anchorAttestation({
  payloadHash: 'b7c2...64-hex-chars',
  purpose:     'regulatory-report',
})

// Record a key rotation
await chain.rotateKey({
  newKid:          'bb39a48bc5e4d1f0',
  newPublicKeyHex: Buffer.from(newPublicKey).toString('hex'),
})
```

All methods return `Promise<{ txHash: string, blockNumber: number }>` on success and throw `KxcoChainError` on failure.

---

## Error handling

```js
import { KxcoChain, KxcoChainError } from 'kxco-pq-chain'

try {
  await chain.issueCredential({ ... })
} catch (err) {
  if (err instanceof KxcoChainError) {
    console.error(err.code)    // 'CREDIT_EXHAUSTED', 'TIMEOUT', 'NETWORK_ERROR', ...
    console.error(err.status)  // HTTP status or null
    console.error(err.body)    // raw relay response body or null
  }
}
```

Common error codes: `BAD_CONFIG`, `TIMEOUT`, `NETWORK_ERROR`, `PARSE_ERROR`, `RELAY_ERROR`, plus relay-specific codes like `CREDIT_EXHAUSTED`.

---

## Relay request format

Every request is a signed JSON intent. The relay validates the ML-DSA-65 signature against the registered institution public key before submitting the EVM transaction.

```json
{
  "operation":      "issueCredential",
  "institutionKid": "aa29f37ab7f4b2cf",
  "nonce":          "<64 random hex chars>",
  "timestamp":      1748342400,
  "payload":        { "...JCS-canonical operation fields..." },
  "signature":      "<ML-DSA-65 hex signature>"
}
```

Signing message (newline-delimited UTF-8):

```
kxco-relay-v1
operation: issueCredential
institutionKid: aa29f37ab7f4b2cf
nonce: <hex>
timestamp: <unix seconds>
payload: <JCS-canonical JSON of payload>
```

Replay protection: the relay rejects requests where `timestamp` is outside ±5 minutes of server time, or where the `nonce` has been seen before.

---

## Low-level helpers

```js
import { buildSigningMessage, buildIntent, randomNonce, canonicalize } from 'kxco-pq-chain'

// Build the canonical signing message for a relay intent
const msg = buildSigningMessage(operation, institutionKid, nonce, timestamp, payload)

// Build and sign a complete relay intent object
const intent = await buildIntent({ operation, institutionKid, payload, identity })

// Generate a cryptographically random 64-hex-char nonce
const nonce = randomNonce()

// RFC 8785 JSON Canonicalization Scheme
const canonical = canonicalize({ b: 2, a: 1 })  // '{"a":1,"b":2}'
```

---

## Requirements

- Node.js 20.19+
- `kxco-post-quantum` (installed automatically as a dependency)

## License

Apache-2.0 — Copyright 2026 KXCO by Knightsbridge
