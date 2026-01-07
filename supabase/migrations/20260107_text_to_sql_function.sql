-- Function to execute read-only SQL queries from AI assistant
-- SECURITY: Only allows SELECT queries, enforced by application layer + this function

CREATE OR REPLACE FUNCTION execute_readonly_sql(query_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Additional safety check at database level
    IF NOT (UPPER(TRIM(query_text)) LIKE 'SELECT%') THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;
    
    -- Check for dangerous keywords
    IF UPPER(query_text) ~ '.*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE).*' THEN
        RAISE EXCEPTION 'Dangerous SQL keyword detected';
    END IF;
    
    -- Execute query and return as JSON
    EXECUTE format('SELECT json_agg(t) FROM (%s) t', query_text) INTO result;
    
    RETURN COALESCE(result, '[]'::json);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'SQL Error: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated and service role
GRANT EXECUTE ON FUNCTION execute_readonly_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_readonly_sql(TEXT) TO service_role;
