-- Add requester_id column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES profiles(id);

-- Update existing tickets: set requester_id = created_by where null
UPDATE tickets SET requester_id = created_by WHERE requester_id IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
