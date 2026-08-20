/**
 * Institutional Domain Whitelist Configuration
 * Add approved college / university domains or domain TLD suffixes here.
 * Matching is performed case-insensitively with whitespace stripped.
 */
export const APPROVED_INSTITUTIONAL_DOMAINS: string[] = [
  'mits.ac.in',
  'mitsgw.ac.in',
  '.ac.in',
  '.edu',
  'iitb.ac.in',
  'iitd.ac.in',
  'bits-pilani.ac.in',
  'stanford.edu',
  'harvard.edu',
  'mit.edu'
];

/**
 * Checks if a given email belongs to an approved institutional domain (e.g. mits.ac.in).
 * Blocks generic public emails like gmail.com, yahoo.com, outlook.com, etc.
 * @param email Email string to test
 * @returns boolean true if email belongs to an approved domain
 */
export function isInstitutionalEmail(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  const domainPart = cleanEmail.split('@')[1];
  if (!domainPart) return false;

  // Explicitly block public commercial email providers
  const BLOCKED_PUBLIC_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'protonmail.com',
    'live.com',
    'zoho.com',
    'yandex.com',
    'gmx.com'
  ];
  if (BLOCKED_PUBLIC_DOMAINS.includes(domainPart)) {
    return false;
  }

  return APPROVED_INSTITUTIONAL_DOMAINS.some(domain => {
    const cleanDomain = domain.trim().toLowerCase();
    if (cleanDomain.startsWith('.')) {
      return domainPart.endsWith(cleanDomain);
    }
    return domainPart === cleanDomain || domainPart.endsWith('.' + cleanDomain);
  });
}
