-- Pre-multi-store orders did not record a trustworthy deployment environment.
-- PostgreSQL requires a newly added enum value to be committed before it is used.
ALTER TYPE "DeploymentEnvironment" ADD VALUE IF NOT EXISTS 'LEGACY';
