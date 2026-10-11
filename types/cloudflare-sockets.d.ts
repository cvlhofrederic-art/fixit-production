// Module intégré du Worker Cloudflare (sockets TCP sortants), importé dynamiquement par
// lib/email-agent/imap/client.ts. Seule la partie utilisée est déclarée.
declare module 'cloudflare:sockets' {
  export interface SocketAddress {
    hostname: string
    port: number
  }
  export interface SocketOptions {
    secureTransport?: 'off' | 'on' | 'starttls'
    allowHalfOpen?: boolean
  }
  export interface Socket {
    readonly readable: ReadableStream<Uint8Array>
    readonly writable: WritableStream<Uint8Array>
    readonly opened: Promise<unknown>
    readonly closed: Promise<void>
    close(): Promise<void>
  }
  export function connect(address: SocketAddress | string, options?: SocketOptions): Socket
}
