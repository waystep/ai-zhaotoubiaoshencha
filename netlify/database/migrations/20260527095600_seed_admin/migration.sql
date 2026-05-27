WITH org_row AS (
  INSERT INTO organizations (name, slug, org_type, created_at, updated_at)
  VALUES ('智能投标预审演示组织', 'demo-tender-review', 'review_org', now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        org_type = EXCLUDED.org_type,
        updated_at = now()
  RETURNING id
),
user_row AS (
  INSERT INTO users (email, email_verified, name, password_hash, role, created_at, updated_at)
  VALUES (
    'admin@ai-shencha.local',
    true,
    '演示管理员',
    '$2a$12$AYB.TH/3VbAfTkJnraTGGeNXPVvqXtM8bXcBQhScNWSPoYbwsH4BC',
    'system_admin',
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        email_verified = true,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        updated_at = now()
  RETURNING id
)
INSERT INTO organization_members (org_id, user_id, role, joined_at)
SELECT org_row.id, user_row.id, 'owner', now()
FROM org_row, user_row
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_members om
  WHERE om.org_id = org_row.id
    AND om.user_id = user_row.id
);
