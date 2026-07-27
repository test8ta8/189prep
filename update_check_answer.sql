CREATE OR REPLACE FUNCTION public.check_practice_answer(p_session_id uuid, p_question_id uuid, p_user_answer text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sq_id uuid;
    v_attempt_count integer;
    v_is_answered boolean;
    v_question record;
    v_is_correct boolean := false;
    v_correct_ans text;
    v_correct_opt text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.test_sessions 
        WHERE id = p_session_id AND user_id = auth.uid() AND status = 'in_progress' AND session_type = 'practice' AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Invalid, expired, or unauthorized practice session';
    END IF;

    SELECT id, attempt_count, is_answered INTO v_sq_id, v_attempt_count, v_is_answered
    FROM public.session_questions
    WHERE session_id = p_session_id AND question_id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found in session'; END IF;
    IF v_is_answered THEN RAISE EXCEPTION 'Question already answered correctly'; END IF;
    IF v_attempt_count >= 3 THEN RAISE EXCEPTION 'Maximum attempts exceeded'; END IF;

    SELECT correct_answer_text, options, correct_option_index, explanation_uz, explanation_ru, question_type, points 
    INTO v_question
    FROM public.questions WHERE id = p_question_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;

    IF v_question.question_type != 'written' THEN
        v_correct_ans := trim(coalesce(v_question.correct_answer_text::text, ''));
        IF v_question.options IS NOT NULL AND v_question.correct_option_index IS NOT NULL THEN
            BEGIN
                v_correct_opt := trim(v_question.options->>v_question.correct_option_index);
            EXCEPTION WHEN OTHERS THEN v_correct_opt := ''; END;
        ELSE v_correct_opt := ''; END IF;

        IF trim(p_user_answer) = v_correct_ans OR (v_correct_opt != '' AND trim(p_user_answer) = v_correct_opt) THEN
            v_is_correct := true;
        ELSIF p_user_answer ~ '^[0-9]+$' AND v_question.correct_option_index IS NOT NULL THEN
            IF p_user_answer::integer = v_question.correct_option_index THEN
                v_is_correct := true;
            END IF;
        END IF;
    END IF;

    UPDATE public.session_questions
    SET attempt_count = attempt_count + 1,
        is_answered = true,
        answered_at = now()
    WHERE id = v_sq_id;

    RETURN jsonb_build_object(
        'success', true,
        'isCorrect', v_is_correct,
        'correctAnswer', coalesce(v_question.correct_answer_text, v_correct_opt),
        'correctOptionIndex', v_question.correct_option_index,
        'explanation_uz', v_question.explanation_uz,
        'explanation_ru', v_question.explanation_ru
    );
END;
$$;
ALTER FUNCTION public.check_practice_answer OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_practice_answer FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_practice_answer TO authenticated;
