export class KxcoChainError extends Error {
  constructor(message, { code, status, body } = {}) {
    super(message)
    this.name   = 'KxcoChainError'
    this.code   = code   ?? 'CHAIN_ERROR'
    this.status = status ?? null
    this.body   = body   ?? null
  }
}
