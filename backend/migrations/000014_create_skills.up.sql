-- Create skills master table (managed by super_admin)
CREATE TABLE skills (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) UNIQUE NOT NULL,
    slug       VARCHAR(100) UNIQUE NOT NULL,
    category   VARCHAR(50)  NOT NULL DEFAULT 'General',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Skills that a user claims to have
CREATE TABLE user_skills (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, skill_id)
);

-- Endorsements: who endorsed which user_skill
CREATE TABLE skill_endorsements (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
    endorser_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_skill_id, endorser_id)
);

-- Performance indexes
CREATE INDEX idx_user_skills_user_id  ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX idx_skill_endorsements_user_skill_id ON skill_endorsements(user_skill_id);
CREATE INDEX idx_skill_endorsements_endorser_id   ON skill_endorsements(endorser_id);

-- Pre-populate standard skills
INSERT INTO skills (name, slug, category) VALUES
  ('Go',            'go',           'Backend'),
  ('Python',        'python',       'Backend'),
  ('Rust',          'rust',         'Backend'),
  ('PHP',           'php',          'Backend'),
  ('Java',          'java',         'Backend'),
  ('JavaScript',    'javascript',   'Frontend'),
  ('TypeScript',    'typescript',   'Frontend'),
  ('React',         'react',        'Frontend'),
  ('Vue.js',        'vuejs',        'Frontend'),
  ('Next.js',       'nextjs',       'Frontend'),
  ('Flutter',       'flutter',      'Mobile'),
  ('Kotlin',        'kotlin',       'Mobile'),
  ('Swift',         'swift',        'Mobile'),
  ('Docker',        'docker',       'DevOps'),
  ('Kubernetes',    'kubernetes',   'DevOps'),
  ('Linux',         'linux',        'DevOps'),
  ('CI/CD',         'cicd',         'DevOps'),
  ('PostgreSQL',    'postgresql',   'Database'),
  ('MySQL',         'mysql',        'Database'),
  ('MongoDB',       'mongodb',      'Database'),
  ('Redis',         'redis',        'Database'),
  ('Git',           'git',          'Tools'),
  ('Fullstack',     'fullstack',    'General'),
  ('Backend',       'backend',      'General'),
  ('Frontend',      'frontend',     'General'),
  ('DevOps',        'devops',       'General'),
  ('Mobile',        'mobile',       'General'),
  ('Machine Learning', 'ml',        'AI/ML'),
  ('Data Science',  'data-science', 'AI/ML');
