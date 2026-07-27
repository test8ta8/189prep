-- Fix for get_exam_questions and get_question_metadata
-- The frontend sets question status to 'published', but these functions were looking for 'approved'.

-- 1. Update get_exam_questions
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

    RETURN QUERY
    SELECT q.id::uuid, q.test_id::uuid, q.order_num::integer, q.text::text, q.image_url::text, 
           q.options::jsonb, q.points::numeric, q.topic::text, q.subtopic::text, q.difficulty::text, 
           q.status::text, q.question_type::text
    FROM public.questions q
    WHERE q.test_id = v_test_id AND q.status = 'published'
    ORDER BY q.order_num ASC;
END;
$$;
ALTER FUNCTION public.get_exam_questions OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_exam_questions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions TO authenticated;

-- 2. Update get_question_metadata
CREATE OR REPLACE FUNCTION public.get_question_metadata(p_test_ids uuid[])
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, question_type text, difficulty text, topic text, subtopic text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT q.id::uuid, q.test_id::uuid, q.order_num::integer, q.question_type::text, q.difficulty::text, q.topic::text, q.subtopic::text
    FROM public.questions q
    JOIN public.mock_tests mt ON mt.id = q.test_id
    WHERE q.test_id = ANY(p_test_ids) AND q.status = 'published' AND mt.is_hidden = false;
END;
$$;
ALTER FUNCTION public.get_question_metadata OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_question_metadata FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_question_metadata TO authenticated;
