/** Hide Home/Calendar while a sheet covers the app (offer, search, Ban thờ). */
export function showAppTabBar(opts: {
  busy: boolean;
  dedicationSheet: unknown;
  historyGroup: unknown;
  altarOpen: boolean;
  amendSheet: unknown;
  searchOpen: boolean;
}): boolean {
  return !(
    opts.busy ||
    Boolean(opts.dedicationSheet) ||
    Boolean(opts.historyGroup) ||
    opts.altarOpen ||
    Boolean(opts.amendSheet) ||
    opts.searchOpen
  );
}
