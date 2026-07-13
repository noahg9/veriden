// Auth is behind a single internal interface so the credential mechanism can be
// swapped without touching the rest of the extension (NFR-003). The API-key
// implementation ships now; an OAuth implementation can slot in behind this
// same interface once provider terms are verified (OQ-1).
export interface AuthProvider {
  getKey(): Promise<string | undefined>;
  setKey(key: string): Promise<void>;
  clearKey(): Promise<void>;
  hasKey(): Promise<boolean>;
}
