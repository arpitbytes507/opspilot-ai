declare module 'cookie' {
  export function parse(input: string): Record<string, string>;
  export function serialize(name: string, value: string, options?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    path?: string;
    maxAge?: number;
  }): string;
}