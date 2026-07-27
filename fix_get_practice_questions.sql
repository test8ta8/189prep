CREATE OR REPLACE FUNCTION public.get_practice_questions(p_session_id uuid)
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, text text, image_url text, 
    options jsonb, points numeric, topic text, subtopic text, difficulty text, 
    status text, question_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.test_sessions ts
        WHERE ts.id = p_session_id AND ts.user_id = auth.uid() AND ts.status = 'in_progress' AND ts.session_type = 'practice' AND ts.expires_at > now()
    ) THEN RAISE EXCEPTION 'Invalid or expired practice session'; END IF;

    RETURN QUERY
    SELECT q.id, q.test_id, q.order_num, q.text, q.image_url, q.options, 
           q.points, q.topic, q.subtopic, q.difficulty, q.status, q.question_type
    FROM public.questions q
    JOIN public.session_questions sq ON sq.question_id = q.id
    WHERE sq.session_id = p_session_id
    ORDER BY random();
END;
$$;
ALTER FUNCTION public.get_practice_questions OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_practice_questions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practice_questions TO authenticated;
