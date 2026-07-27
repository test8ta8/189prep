-- 0. Fix test_sessions table to allow practice sessions without a specific test_id
ALTER TABLE public.test_sessions ALTER COLUMN test_id DROP NOT NULL;

-- 1. Function to securely get the exact count of valid practice questions
CREATE OR REPLACE FUNCTION public.get_practice_count(p_subject text, p_difficulties text[]) 
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(q.id) INTO v_count
    FROM public.questions q
    JOIN public.mock_tests mt ON mt.id = q.test_id
    WHERE q.status = 'published'
      AND mt.is_hidden = false
      AND mt.is_premium = false
      AND mt.exam_system != 'alevel'
      AND q.question_type NOT IN ('written', 'essay')
      AND (array_length(p_difficulties, 1) IS NULL OR q.difficulty = ANY(p_difficulties))
      AND (
          (mt.exam_system != 'dtm' AND mt.subject ILIKE '%' || p_subject || '%')
          OR
          (mt.exam_system = 'dtm' AND (
              (p_subject ILIKE '%ona tili%' AND q.order_num BETWEEN 1 AND 10) OR
              (p_subject ILIKE '%matematika%' AND q.order_num BETWEEN 11 AND 20) OR
              (p_subject ILIKE '%tarix%' AND q.order_num BETWEEN 21 AND 30) OR
              (mt.subject ILIKE p_subject || '%' AND q.order_num BETWEEN 31 AND 60) OR
              (mt.subject ILIKE '%' || p_subject AND mt.subject NOT ILIKE p_subject || '%' AND q.order_num BETWEEN 61 AND 90)
          ))
      );
      
    RETURN v_count;
END;
$$;
ALTER FUNCTION public.get_practice_count OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_practice_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practice_count TO authenticated;

-- 2. Function to atomically generate a practice session from random valid questions
CREATE OR REPLACE FUNCTION public.generate_random_practice_session(p_subject text, p_difficulties text[], p_limit int) 
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_new_session_id uuid;
BEGIN
    -- Prevent TOCTOU / concurrent rapid clicks
    PERFORM pg_advisory_xact_lock(hashtext('practice_' || auth.uid()::text));

    -- Abandon old practice sessions
    UPDATE public.test_sessions 
    SET status = 'abandoned' 
    WHERE user_id = auth.uid() AND status = 'in_progress' AND session_type = 'practice';
    
    -- Create new session
    INSERT INTO public.test_sessions (user_id, status, session_type, expires_at)
    VALUES (auth.uid(), 'in_progress', 'practice', now() + interval '24 hours')
    RETURNING id INTO v_new_session_id;

    -- Select random questions securely and attach to session
    INSERT INTO public.session_questions (session_id, question_id)
    SELECT v_new_session_id, q.id
    FROM public.questions q
    JOIN public.mock_tests mt ON mt.id = q.test_id
    WHERE q.status = 'published'
      AND mt.is_hidden = false
      AND mt.is_premium = false
      AND mt.exam_system != 'alevel'
      AND q.question_type NOT IN ('written', 'essay')
      AND (array_length(p_difficulties, 1) IS NULL OR q.difficulty = ANY(p_difficulties))
      AND (
          (mt.exam_system != 'dtm' AND mt.subject ILIKE '%' || p_subject || '%')
          OR
          (mt.exam_system = 'dtm' AND (
              (p_subject ILIKE '%ona tili%' AND q.order_num BETWEEN 1 AND 10) OR
              (p_subject ILIKE '%matematika%' AND q.order_num BETWEEN 11 AND 20) OR
              (p_subject ILIKE '%tarix%' AND q.order_num BETWEEN 21 AND 30) OR
              (mt.subject ILIKE p_subject || '%' AND q.order_num BETWEEN 31 AND 60) OR
              (mt.subject ILIKE '%' || p_subject AND mt.subject NOT ILIKE p_subject || '%' AND q.order_num BETWEEN 61 AND 90)
          ))
      )
    ORDER BY random()
    LIMIT p_limit;

    RETURN v_new_session_id;
END;
$$;
ALTER FUNCTION public.generate_random_practice_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.generate_random_practice_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_random_practice_session TO authenticated;

-- 3. Fix ambiguous column reference in get_practice_questions
CREATE OR REPLACE FUNCTION public.get_practice_questions(p_session_id uuid)
RETURNS TABLE (
    id uuid, test_id uuid, order_num integer, text text, image_url text, 
    options jsonb, points numeric, topic text, subtopic text, difficulty text, 
    status text, question_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

