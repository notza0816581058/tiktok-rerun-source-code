export function mergeAccountUpdate<T extends { id: string; owner?: string }>(
  previous: { id: string; owner?: string },
  updated: T,
): T & { owner?: string } {
  return { ...updated, owner: updated.owner ?? previous.owner };
}

export function selectAccountForView(
  accounts: { id: string; verificationStatus: string }[],
  current: string,
  requested: string | null,
) {
  if (requested) {
    return accounts.some(
      (account) => account.id === requested && account.verificationStatus === 'connected',
    )
      ? requested
      : '';
  }
  if (current && accounts.some((account) => account.id === current)) return current;
  return accounts.find((account) => account.verificationStatus === 'connected')?.id ?? '';
}
