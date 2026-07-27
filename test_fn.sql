set local request.jwt.claim.sub = '49327bf0-6a03-4ccd-bdb6-ba129fbe4a5c';
set local role = authenticated;
select * from public.get_exam_questions('bd22dc03-b04d-4035-a5a1-700f296a116a');
