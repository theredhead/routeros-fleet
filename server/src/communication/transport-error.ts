export type TransportFailureReason = 'authentication' | 'host-key' | 'protocol';
export class TransportFailure extends Error {
  constructor(readonly reason: TransportFailureReason) { super('Transport verification failed'); }
}
export function describeTransportFailure(error: unknown): string {
  const detail = error as {code?: string; response?: {status?: number}};
  if (error instanceof TransportFailure) return {authentication: 'Login was rejected or this account cannot use the service.', 'host-key': 'SSH host key is untrusted or changed. Check the fingerprint before login.', protocol: 'The service did not return a valid RouterOS response.'}[error.reason];
  if (detail?.response?.status === 401) return 'Username or password was rejected.';
  if (detail?.response?.status === 403) return 'The account or endpoint does not permit this operation.';
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(detail?.code))) return 'TLS certificate verification failed. Review the certificate and trust setting.';
  if (['ETIMEDOUT', 'ECONNABORTED'].includes(detail?.code || '')) return 'Connection timed out.';
  if (detail?.code === 'ECONNREFUSED') return 'Connection was refused. Check the port and whether the service is enabled.';
  return 'Connection or RouterOS verification failed. Check service availability, credentials and permissions.';
}
