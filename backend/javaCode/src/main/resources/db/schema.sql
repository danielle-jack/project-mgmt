-- Schema for the project tracker (PostgreSQL).
--
-- Nothing in this schema is ever deleted: users and assignments are deactivated,
-- projects are archived. Foreign keys therefore use the default ON DELETE RESTRICT
-- so an accidental DELETE fails instead of cascading.
--
-- Rules that span multiple rows are enforced in the service layer, not here:
--   * only admins create users and projects; managers edit only their own projects
--   * an employee's manager_id must point at an active MANAGER
--   * a project's manager_id must point at an active MANAGER
--   * an employee's active assignments may total more than 40 hours/week only when the
--     manager confirms it; anyone over 40 is reported as over-allocated
--   * assignment dates fall within the project's dates
--   * archived projects (and their assignments and milestones) are read-only
--   * milestone dependencies contain no cycles

-- 1. Users ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255),          -- PBKDF2 hash (see Passwords.java); NULL means the user can't log in
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')),
    manager_id     BIGINT REFERENCES users (user_id),
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by     BIGINT REFERENCES users (user_id),   -- the admin who created this user; NULL for the first admin
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Every employee has exactly one manager; admins and managers have none.
    CONSTRAINT users_manager_matches_role CHECK (
        (role = 'EMPLOYEE' AND manager_id IS NOT NULL)
        OR (role <> 'EMPLOYEE' AND manager_id IS NULL)
    ),
    CONSTRAINT users_not_own_manager CHECK (manager_id <> user_id)
);

CREATE INDEX IF NOT EXISTS users_manager_idx ON users (manager_id);

-- 2. Projects ------------------------------------------------------------------
-- Total hours are not stored; see the project_hours view below.

CREATE TABLE IF NOT EXISTS projects (
    project_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(150) NOT NULL,
    description         TEXT,
    manager_id          BIGINT       NOT NULL REFERENCES users (user_id),
    start_date          DATE         NOT NULL,
    predicted_end_date  DATE         NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    completed_at        TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    created_by          BIGINT       NOT NULL REFERENCES users (user_id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT projects_dates_ordered CHECK (predicted_end_date >= start_date),
    CONSTRAINT projects_completed_at_matches_status CHECK (
        (status = 'ACTIVE' AND completed_at IS NULL) OR status <> 'ACTIVE'
    ),
    CONSTRAINT projects_archived_at_matches_status CHECK (
        (status = 'ARCHIVED') = (archived_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS projects_manager_idx ON projects (manager_id);

-- 3. Project assignments -------------------------------------------------------
-- A project's team is its set of active assignments. Removing someone from a team
-- sets active = FALSE; the row stays.

CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT       NOT NULL REFERENCES projects (project_id),
    employee_id     BIGINT       NOT NULL REFERENCES users (user_id),
    hours_per_week  NUMERIC(4,1) NOT NULL CHECK (hours_per_week > 0 AND hours_per_week <= 40),
    start_date      DATE         NOT NULL,   -- defaults to the project's start date (set by the service)
    end_date        DATE         NOT NULL,   -- defaults to the project's predicted end date
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    assigned_by     BIGINT       NOT NULL REFERENCES users (user_id),
    deactivated_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT assignments_dates_ordered CHECK (end_date >= start_date),
    CONSTRAINT assignments_deactivated_at_matches_active CHECK (
        active = (deactivated_at IS NULL)
    )
);

-- At most one active assignment per employee per project; past ones are kept.
CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_active_per_project
    ON project_assignments (project_id, employee_id) WHERE active;

-- Used by the 40-hour check.
CREATE INDEX IF NOT EXISTS assignments_employee_active_idx
    ON project_assignments (employee_id) WHERE active;

-- 4. Milestones ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS milestones (
    milestone_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id        BIGINT       NOT NULL REFERENCES projects (project_id),
    title             VARCHAR(150) NOT NULL,
    description       TEXT,
    start_date        DATE         NOT NULL,
    due_date          DATE         NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'NOT_STARTED'
                      CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    progress_percent  SMALLINT     NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    completed_at      TIMESTAMPTZ,
    created_by        BIGINT       NOT NULL REFERENCES users (user_id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT milestones_dates_ordered CHECK (due_date >= start_date),
    CONSTRAINT milestones_completed_consistent CHECK (
        (status = 'COMPLETED') = (completed_at IS NOT NULL)
        AND (status <> 'COMPLETED' OR progress_percent = 100)
    ),
    CONSTRAINT milestones_id_project_unique UNIQUE (milestone_id, project_id)
);

CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones (project_id);

-- 5. Milestone dependencies ----------------------------------------------------
-- A milestone can depend on others in its own project, or in a project its project
-- depends on (checked by MilestoneService). project_id is the dependent milestone's
-- project. Direct self-dependency is blocked here; longer loops by MilestoneService.

CREATE TABLE IF NOT EXISTS milestone_dependencies (
    milestone_id   BIGINT NOT NULL,
    depends_on_id  BIGINT NOT NULL,
    project_id     BIGINT NOT NULL,

    PRIMARY KEY (milestone_id, depends_on_id),
    CONSTRAINT milestone_dependencies_milestone_fk  FOREIGN KEY (milestone_id)  REFERENCES milestones (milestone_id),
    CONSTRAINT milestone_dependencies_depends_on_fk FOREIGN KEY (depends_on_id) REFERENCES milestones (milestone_id),
    CONSTRAINT dependencies_not_self CHECK (milestone_id <> depends_on_id)
);

-- Projects that must be finished before a project can be completed.
CREATE TABLE IF NOT EXISTS project_dependencies (
    project_id             BIGINT NOT NULL REFERENCES projects (project_id),
    depends_on_project_id  BIGINT NOT NULL REFERENCES projects (project_id),

    PRIMARY KEY (project_id, depends_on_project_id),
    CONSTRAINT project_dependencies_not_self CHECK (project_id <> depends_on_project_id)
);

CREATE INDEX IF NOT EXISTS project_dependencies_depends_on_idx ON project_dependencies (depends_on_project_id);

CREATE INDEX IF NOT EXISTS dependencies_depends_on_idx ON milestone_dependencies (depends_on_id);

-- 6. Audit log -----------------------------------------------------------------
-- Records changes by anyone (admins, and managers editing their projects).

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id     BIGINT       NOT NULL REFERENCES users (user_id),
    action       VARCHAR(50)  NOT NULL,   -- e.g. CREATE_USER, MOVE_EMPLOYEE, ARCHIVE_PROJECT
    entity_type  VARCHAR(30)  NOT NULL,   -- e.g. USER, PROJECT, ASSIGNMENT, MILESTONE
    entity_id    BIGINT       NOT NULL,
    details      JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

-- 7. App secrets ---------------------------------------------------------------
-- The key login tokens are signed with. Generated once by the backend (Database.java);
-- anyone who can read it can forge logins, so keep database access restricted.

CREATE TABLE IF NOT EXISTS app_secrets (
    name        VARCHAR(50) PRIMARY KEY,
    value       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Upgrades for databases created by an earlier version of this file --------
-- Everything here is safe to run again and again.

-- Reasons given when something is "deleted" (deactivated, archived, removed from a team).
ALTER TABLE users               ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE projects            ADD COLUMN IF NOT EXISTS archive_reason      TEXT;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS removal_reason      TEXT;

-- Profile photo: a small image as a data URL (see UserService.setPhoto).
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;

-- Milestone dependencies used to be limited to one project; allow other projects.
ALTER TABLE milestone_dependencies DROP CONSTRAINT IF EXISTS milestone_dependencies_milestone_id_project_id_fkey;
ALTER TABLE milestone_dependencies DROP CONSTRAINT IF EXISTS milestone_dependencies_depends_on_id_project_id_fkey;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'milestone_dependencies_milestone_fk') THEN
        ALTER TABLE milestone_dependencies ADD CONSTRAINT milestone_dependencies_milestone_fk
            FOREIGN KEY (milestone_id) REFERENCES milestones (milestone_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'milestone_dependencies_depends_on_fk') THEN
        ALTER TABLE milestone_dependencies ADD CONSTRAINT milestone_dependencies_depends_on_fk
            FOREIGN KEY (depends_on_id) REFERENCES milestones (milestone_id);
    END IF;
END $$;

-- Cost rates and budgets. Labour cost = hours worked so far x the employee's hourly rate;
-- it is calculated (see BudgetCalculator.java), never stored.
ALTER TABLE users    ADD COLUMN IF NOT EXISTS hourly_rate    NUMERIC(8,2)  NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (planned_budget >= 0);

-- 9. Project expenses ----------------------------------------------------------
-- Non-labour spending (licences, hardware, travel...) logged by the project's manager.
-- Mistakes are voided with a reason; the row stays.

CREATE TABLE IF NOT EXISTS project_expenses (
    expense_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id   BIGINT        NOT NULL REFERENCES projects (project_id),
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    spent_on     DATE          NOT NULL,
    description  VARCHAR(200)  NOT NULL,
    active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by   BIGINT        NOT NULL REFERENCES users (user_id),
    voided_at    TIMESTAMPTZ,
    void_reason  TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT expenses_voided_at_matches_active CHECK (active = (voided_at IS NULL))
);

CREATE INDEX IF NOT EXISTS project_expenses_project_idx ON project_expenses (project_id);

-- 10. Calculated project hours --------------------------------------------------
-- Total hours = sum over active assignments of hours_per_week x (workdays / 5),
-- where workdays are Monday-Friday between the assignment's start and end dates.

CREATE OR REPLACE VIEW project_hours AS
SELECT p.project_id,
       COALESCE(SUM(a.hours_per_week * wd.workdays / 5.0), 0) AS total_hours
FROM projects p
LEFT JOIN project_assignments a
       ON a.project_id = p.project_id AND a.active
LEFT JOIN LATERAL (
       SELECT COUNT(*) AS workdays
       FROM generate_series(a.start_date, a.end_date, INTERVAL '1 day') AS d
       WHERE EXTRACT(ISODOW FROM d) < 6
) wd ON TRUE
GROUP BY p.project_id;
