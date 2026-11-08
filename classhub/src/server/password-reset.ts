/**
 * Owner-made password reset links. A ClassHub sign-in is one account across every workspace, so an owner may only
 * reset the password of a member whose account belongs to that owner's workspace alone. Otherwise the owner of one
 * workspace could take over someone's access to another workspace (where that person may even be the owner).
 * The rule is checked when the link is made and again when it is used, because the member can join another
 * workspace while the link is still open.
 */

/** SQL condition: the account `member` has no membership outside workspace `org` (active or not). */
const onlyThisWorkspace = (member: string, org: string) =>
  `NOT EXISTS (SELECT 1 FROM memberships elsewhere WHERE elsewhere.user_id=${member} AND elsewhere.org_id<>${org})`

/** Bind (org_id, user_id). A row means a non-owner member with a password; `shared`=1 means the reset is refused. */
export const resetTargetSql = `SELECT m.user_id, CASE WHEN ${onlyThisWorkspace('m.user_id', 'm.org_id')} THEN 0 ELSE 1 END AS shared
  FROM memberships m JOIN account a ON a.userId=m.user_id AND a.providerId='credential'
  WHERE m.org_id=? AND m.user_id=? AND m.role<>'owner'`

/** Bind (token_hash, now). A row is an open link whose member still belongs to the link's workspace alone. */
export const resetRedeemSql = `SELECT r.id,r.user_id,u.email FROM password_resets r
  JOIN "user" u ON u.id=r.user_id JOIN account a ON a.userId=r.user_id AND a.providerId='credential'
  WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>? AND ${onlyThisWorkspace('r.user_id', 'r.org_id')}`

export const sharedAccountMessage =
  'Tài khoản này còn được dùng ở đơn vị khác nên chủ đơn vị không thể đặt lại mật khẩu. Hãy nhờ AFYLLX hỗ trợ.'
