-- Preserve the historical authority classifications while adding the canonical
-- authority used by domain-owned Attention projections.
ALTER TYPE "WorkItemAuthority" ADD VALUE IF NOT EXISTS 'ATTENTION_PROJECTION';
