-- A school opts in to the public student timetable by choosing a slug. NULL keeps it private.
ALTER TABLE organizations ADD COLUMN public_slug TEXT;
CREATE UNIQUE INDEX organizations_public_slug ON organizations(public_slug) WHERE public_slug IS NOT NULL;

-- A session an administrator cancelled or rescheduled by hand. Timetable reconciliation leaves it alone.
ALTER TABLE class_sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1));
