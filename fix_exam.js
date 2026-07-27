import fs from 'fs';
let code = fs.readFileSync('src/pages/ExamArena/ExamLayout.jsx', 'utf8');

// 1. Add useRef
code = code.replace(/import React, { useState, useEffect } from 'react';/, "import React, { useState, useEffect, useRef } from 'react';");

// 2. Add isMounted
code = code.replace(/useEffect\(\(\) => {\s*async function loadData\(\) {\s*try {\s*setLoading\(true\);/, `useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        if (isMounted) setLoading(true);`);

// 3. Add debug and isMounted check
code = code.replace(/const { data: qData, error: qError } = await supabase.rpc\('get_exam_questions', { p_session_id: newSessionId }\);\s*if \(qError\) throw new Error\(qError\.message\);\s*if \(qData\) {\s*setQuestions\(qData\);\s*}/, `const { data: qData, error: qError } = await supabase.rpc('get_exam_questions', { p_session_id: newSessionId });
          window.DEBUG_Q_ERR = qError ? qError.message : null;
          window.DEBUG_Q_DATA = qData ? JSON.stringify(qData) : null;

          if (qError) throw new Error(qError.message);
          if (qData && isMounted) {
            setQuestions(qData);
          }`);

// 4. Add isMounted check to bookmarks
code = code.replace(/if \(bData\) {\s*setBookmarks\(new Set\(bData.map\(b => b.question_id\)\)\);\s*}/, `if (bData && isMounted) {
            setBookmarks(new Set(bData.map(b => b.question_id)));
          }`);

// 5. Add cleanup
code = code.replace(/} finally {\s*setLoading\(false\);\s*}\s*}\s*if \(testId \|\| customConfig\) loadData\(\);\s*}, \[testId, customConfig, user\?\.id, currentPaperIndex\]\);/, `} finally {
        if (isMounted) setLoading(false);
      }
    }

    if (testId || customConfig) loadData();
    return () => { isMounted = false; };
  }, [testId, customConfig, user?.id, currentPaperIndex]);`);

// 6. Add debug text to empty state
code = code.replace(/<p style={{ fontSize: '18px', color: '#0F172A', fontWeight: '500', margin: 0 }}>Bu test uchun savollar topilmadi.<\/p>/g, `<p style={{ fontSize: '18px', color: '#0F172A', fontWeight: '500', margin: 0 }}>Bu test uchun savollar topilmadi.</p>
                  <p style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>DEBUG_ERR: {window.DEBUG_Q_ERR || 'No error'}</p>
                  <p style={{ color: 'gray', marginTop: '10px', fontSize: '14px' }}>DEBUG_DATA: {window.DEBUG_Q_DATA || 'No data'}</p>`);

fs.writeFileSync('src/pages/ExamArena/ExamLayout.jsx', code);
