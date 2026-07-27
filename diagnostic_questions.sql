-- Diagnostic SQL to temporarily remove the status filter
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_session_id uuid)
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, text text, image_url text, 
    options jsonb, points numeric, topic text, subtopic text, difficulty text, 
    status text, question_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_test_id uuid;
BEGIN
    -- Secure lookup of the session to get the test_id
    SELECT ts.test_id INTO v_test_id 
    FROM public.test_sessions ts 
    WHERE ts.id = p_session_id AND ts.user_id = auth.uid() AND ts.status = 'in_progress' AND ts.session_type = 'exam' AND ts.expires_at > now();

    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or unauthorized exam session'; END IF;

    -- Return all questions for this test_id, regardless of status, for debugging
    RETURN QUERY
    SELECT q.id, q.test_id, q.order_num, q.text, q.image_url, q.options, 
           q.points, q.topic, q.subtopic, q.difficulty, q.status, q.question_type
    FROM public.questions q
    WHERE q.test_id = v_test_id
    ORDER BY q.order_num ASC;
END;
$$;
ALTER FUNCTION public.get_exam_questions OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_exam_questions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions TO authenticated;
