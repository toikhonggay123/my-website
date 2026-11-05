-- Run through the local setup command on ClassHub's local D1 only.
INSERT OR IGNORE INTO "user"(id,name,email,emailVerified,createdAt,updatedAt)
VALUES ('51740000-0000-4000-8000-000000000001','Quản trị ClassHub','local-admin@classhub.invalid',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO organizations(id,name,type,created_at,updated_at)
SELECT '51740000-0000-4000-8000-000000000002','Đơn vị của tôi','center',unixepoch()*1000,unixepoch()*1000
WHERE NOT EXISTS (SELECT 1 FROM organizations);

INSERT OR IGNORE INTO branches(org_id,id,name)
SELECT id,'51740000-0000-4000-8000-000000000003','Cơ sở chính'
FROM organizations WHERE id='51740000-0000-4000-8000-000000000002';

INSERT OR IGNORE INTO memberships(org_id,user_id,role,created_at)
SELECT o.id,u.id,'owner',unixepoch()*1000 FROM organizations o CROSS JOIN "user" u
WHERE o.status='active' AND u.email='local-admin@classhub.invalid';
