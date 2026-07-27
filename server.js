import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY // SECURE: Uses Secret Key for backend admin tasks
);

const getUserSupabase = (req) => {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://challenges.cloudflare.com"],
      frameSrc: ["'self'", "https://challenges.cloudflare.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    
    const allowed = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : [];
    allowed.push('https://189prep.vercel.app', 'https://189prep.uz');
    
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200 
}));
app.use(express.json({ limit: '100kb' })); // Prevents large payload DoS

app.use((req, res, next) => {
  req.setTimeout(10000, () => res.status(408).send('Request Timeout'));
  next();
});

const keyGenerator = (req) => {
  if (req.user && req.user.id) return req.user.id;
  // express-rate-limit complains if we just return req.ip for IPv6 (::1).
  // Safely fallback:
  return req.ip === '::1' ? '127.0.0.1' : (req.ip || 'unknown');
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  keyGenerator,
  message: { error: 'Too many requests, please try again later.' }
});

const strictLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 secs
  max: 20, // 2 req/sec
  keyGenerator,
  message: { error: 'Strict rate limit exceeded. Slow down.' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator,
  message: { error: 'Too many requests, please try again later.' }
});

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  
  req.user = data.user;
  next();
};

app.post('/parse-pdf', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF provided' });
    }

    // Limit PDF size (~15MB base64 ≈ ~11MB file)
    if (pdfBase64.length > 20_000_000) {
      return res.status(400).json({ error: 'PDF too large (max ~15MB)' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    const prompt = `You are a strict data parser. I am providing a test/exam in PDF format.
Extract all the multiple-choice questions from this PDF.

CRITICAL MATH FORMATTING RULE: All mathematical formulas, numbers, equations, and variables MUST be wrapped in LaTeX delimiters. Use $...$ for inline math and $$...$$ for block math. NEVER output raw math symbols without these delimiters!
Because you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g., write \\\\frac instead of \\frac).

Return ONLY a raw JSON array (no markdown fences, no commentary, no preamble). Do not include any comments (// or /*).
Each element must be an object with EXACTLY these fields:

{
  "text": "The text of the question",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correct_option_index": 0,
  "explanation_uz": "Detailed, step-by-step expert explanation of why the answer is correct in Uzbek. If not present in source, write a brief correct explanation yourself.",
  "explanation_ru": "Detailed, step-by-step expert explanation of why the answer is correct in Russian. If not present in source, write a brief correct explanation yourself.",
  "points": 1,
  "topic": "best-guess subject/sub-topic based on content",
  "difficulty": "easy"
}

Rules:
- Extract every question found in the PDF, in the order they appear. Do not skip, merge, or invent questions.
- If a question has no clearly marked correct answer, make your best determination based on subject knowledge, but NEVER leave correct_option_index blank.
- "points" should be a number (default to 1).
- "difficulty" MUST be exactly one of: "easy", "medium", or "hard" (best-guess based on complexity).
- If you cannot parse it, return an empty array [].`;

    let response;
    let geminiData;
    let retries = 3;
    let delay = 2000; // 2 seconds

    while (retries > 0) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: "application/pdf",
                        data: pdfBase64
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        geminiData = await response.json();
        
        if (response.ok) {
          break; // Success! Exit loop.
        }

        // If it's a 503 (Service Unavailable) and we have retries left, wait and try again
        if (response.status === 503 && retries > 1) {
          console.log(`Gemini API 503 Error. Retrying in ${delay/1000}s... (${retries - 1} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          retries--;
          continue;
        }

        // If it's another error or we ran out of retries, throw it
        throw new Error(`Gemini API Error: ${JSON.stringify(geminiData)}`);
      } catch (err) {
        if (retries <= 1) throw err;
        console.log(`Fetch failed. Retrying in ${delay/1000}s... (${retries - 1} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        retries--;
      }
    }

    let extractedText = geminiData.candidates[0].content.parts[0].text;
    extractedText = extractedText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Fix unescaped backslashes for LaTeX (e.g. \frac -> \\frac) so JSON.parse doesn't crash
    // This robust regex catches 1, 2, 3, or 4 backslashes and normalizes them to exactly 2 backslashes,
    // while completely ignoring valid JSON escapes like \n, \", or \\
    extractedText = extractedText.replace(/\\+([^"\\/bfnrtu])/g, '\\\\$1');
    
    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(extractedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini output. Raw text:", extractedText);
      throw new Error("AI gegerated invalid JSON format. Please try again.");
    }

    res.json({ questions: parsedQuestions });

  } catch (error) {
    console.error('parse-pdf error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

app.post('/api/detect-boxes', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { pageBase64 } = req.body;
    if (!pageBase64) {
      return res.status(400).json({ error: 'No page image provided' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    const prompt = `Analyze this test page image. Identify the bounding boxes for every distinct multiple-choice or math question present on the page.
A question typically includes the passage/context, the prompt, the graphic/chart (if any), and all answer choices.
Return a valid JSON array of objects. Each object should represent a single question area and must contain exactly these fields:
- "questionNumber": the integer number printed next to the question (or your best guess of its order).
- "ymin", "xmin", "ymax", "xmax": exactly these 4 integer values between 0 and 1000 representing scaled coordinates relative to the image dimensions.
- "isValid": a boolean (true/false) that is true ONLY if the box successfully captures the FULL context, the prompt, and ALL 4 answer choices (if multiple choice). Mark it false if it is cut off or missing choices.
- "hasImage": a boolean. true if the question contains a graph, chart, figure, table, or any visual diagram that is essential to answering the question. false if it is text-only.

Do not include \`\`\`json or markdown, just the raw JSON array.
If no questions are found, return an empty array [].`;

    let response;
    let geminiData;
    let retries = 15;
    let delay = 5000; // 5 seconds

    while (retries > 0) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: pageBase64
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        geminiData = await response.json();
        
        if (response.ok) {
          break; // Success!
        }

        if ((response.status === 503 || response.status === 429) && retries > 1) {
          console.log(`Gemini API ${response.status} Error in detect-boxes. Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 30000); // max 30s delay
          retries--;
          continue;
        }

        throw new Error(JSON.stringify(geminiData));
      } catch (err) {
        if (retries <= 1) throw err;
        console.log(`Fetch failed in detect-boxes. Retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000);
        retries--;
      }
    }

    let text = geminiData.candidates[0].content.parts[0].text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let boxes = [];
    try {
      boxes = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse boxes:", text);
      boxes = [];
    }

    res.json({ boxes });
  } catch (error) {
    console.error('detect-boxes error:', error);
    res.status(500).json({ error: 'Failed to detect boxes' });
  }
});

app.post('/api/parse-cropped', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    const prompt = `You are a strict data parser. I am providing an image of a single multiple-choice question.
Extract the question data.

CRITICAL MATH FORMATTING RULE: All mathematical formulas, numbers, equations, and variables MUST be wrapped in LaTeX delimiters. Use $...$ for inline math and $$...$$ for block math.
Because you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g., write \\\\frac instead of \\frac).

Return ONLY a raw JSON object (no markdown fences, no commentary).
The object must contain EXACTLY these fields:
{
  "text": "The text of the question including any context/passage",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correct_option_index": 0,
  "explanation_uz": "Detailed explanation of the correct answer in Uzbek",
  "explanation_ru": "Detailed explanation of the correct answer in Russian",
  "points": 1,
  "topic": "best-guess subject/sub-topic",
  "difficulty": "easy"
}

If a question has no clearly marked correct answer, make your best determination.
Do not wrap in \`\`\`json.`;

    let response;
    let geminiData;
    let retries = 15;
    let delay = 5000;

    while (retries > 0) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: "image/jpeg",
                        data: imageBase64
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        geminiData = await response.json();
        
        if (response.ok) {
          break; // Success!
        }

        if ((response.status === 503 || response.status === 429) && retries > 1) {
          console.log(`Gemini API ${response.status} Error in parse-cropped. Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 30000); 
          retries--;
          continue;
        }

        throw new Error(JSON.stringify(geminiData));
      } catch (err) {
        if (retries <= 1) throw err;
        console.log(`Fetch failed in parse-cropped. Retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 30000);
        retries--;
      }
    }

    let text = geminiData.candidates[0].content.parts[0].text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    text = text.replace(/\\+([^"\\/bfnrtu])/g, '\\\\$1');

    let parsedQuestion;
    try {
      parsedQuestion = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse single question:", text);
      throw new Error("AI generated invalid JSON");
    }

    res.json({ question: parsedQuestion });
  } catch (error) {
    console.error('parse-cropped error:', error);
    res.status(500).json({ error: 'Failed to parse image' });
  }
});

// ==========================================
// SECURE EXAM ENDPOINTS
// ==========================================

app.post('/api/start-exam', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { testId } = req.body;
    if (!testId) return res.status(400).json({ error: 'testId is required' });

    // 1. Validate test exists and is visible
    const { data: test, error: testError } = await supabaseAdmin
      .from('mock_tests')
      .select('is_hidden, is_premium')
      .eq('id', testId)
      .single();

    if (testError || !test || test.is_hidden) {
      return res.status(404).json({ error: 'Test not found or unavailable' });
    }

    // 2. Strict Premium validation
    if (test.is_premium) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, subscription_until, is_suspended')
        .eq('id', req.user.id)
        .single();
        
      if (!profile || profile.is_suspended) {
        return res.status(403).json({ error: 'Account suspended or profile not found' });
      }

      const now = new Date();
      const subEnd = profile.subscription_until ? new Date(profile.subscription_until) : null;
      const isSubActive = profile.subscription_tier !== 'free' && subEnd && subEnd > now;
      
      if (!isSubActive) {
        return res.status(403).json({ error: 'Premium subscription required' });
      }
    }

    // 3. Create Session atomically (Runs AS THE USER to trigger RLS and auth.uid())
    const userClient = getUserSupabase(req);
    const { data: sessionId, error: rpcError } = await userClient.rpc('create_exam_session', { p_test_id: testId });
    
    if (rpcError) {
      console.error('Session creation failed:', rpcError);
      return res.status(500).json({ error: 'Failed to start exam session' });
    }

    res.json({ success: true, sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/submit-exam', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { sessionId, answers, timeSpentSecs } = req.body;
    const userId = req.user.id;

    if (!sessionId || !answers) {
      return res.status(400).json({ error: 'sessionId and answers are required' });
    }

    // 1. Atomically finalize session to prevent replay
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('test_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .gt('expires_at', new Date().toISOString())
      .select('id, test_id, session_type')
      .single();

    if (sessionError || !sessionData) {
      return res.status(400).json({ error: 'Invalid, expired, or already submitted session' });
    }

    const testId = sessionData.test_id;

    // 2. Fetch Test Info and Questions securely via Service Role
    let testInfo = { exam_system: 'dtm' }; // default
    let questions = [];

    if (sessionData.session_type === 'exam') {
      const { data: tInfo } = await supabaseAdmin.from('mock_tests').select('*').eq('id', testId).single();
      if (tInfo) testInfo = tInfo;
      const { data: qData } = await supabaseAdmin.from('questions').select('*').eq('test_id', testId).order('order_num', { ascending: true });
      questions = qData || [];
    } else {
      // Practice session submitted as an exam (Custom Test flow)
      const { data: sqData } = await supabaseAdmin.from('session_questions')
        .select('questions(*)')
        .eq('session_id', sessionId);
      questions = sqData ? sqData.map(sq => sq.questions) : [];
      // Questions don't have a guaranteed order from session_questions, but frontend handles the grading order mapping via IDs.
    }

    if (questions.length === 0) return res.status(500).json({ error: 'Failed to grade questions: No questions found' });

    let totalPointsEarned = 0;
    const attemptsToInsert = [];
    const gradedQuestions = [];

    // 3. Grade securely
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAns = answers[q.id];
      
      let pts = q.points || 1;
      if (testInfo.exam_system === 'dtm') {
        if (i < 30) pts = 1.1; else if (i < 60) pts = 3.1; else pts = 2.1;
      }

      let isCorrect = false;
      let pointsEarned = 0;

      if (userAns !== undefined && userAns !== null && q.question_type !== 'essay') {
        const correctAns = (q.correct_answer_text || '').toString().trim();
        const userAnsStr = userAns.toString().trim();

        if (q.question_type === 'multipart_ab') {
          try {
            const uAnsObj = typeof userAns === 'string' ? JSON.parse(userAns) : userAns;
            const cAnsObj = JSON.parse(correctAns);
            const uA = (uAnsObj.a || '').toString().trim().toLowerCase();
            const uB = (uAnsObj.b || '').toString().trim().toLowerCase();
            const cA = (cAnsObj.a || '').toString().trim().toLowerCase();
            const cB = (cAnsObj.b || '').toString().trim().toLowerCase();
            
            if (uA !== '' && uB !== '' && uA === cA && uB === cB) {
              isCorrect = true;
              pointsEarned = pts;
            } else if ((uA !== '' && uA === cA) || (uB !== '' && uB === cB)) {
              isCorrect = false; // Partially correct
              pointsEarned = pts / 2; // Half points
            }
          } catch(e) {}
        } else if (q.question_type === 'written') {
          const validAnswers = correctAns.split(',').map(s => s.trim().toLowerCase());
          if (validAnswers.includes(userAnsStr.toLowerCase())) {
            isCorrect = true;
            pointsEarned = pts;
          }
        } else {
          let parsedOptions = q.options;
          if (typeof parsedOptions === 'string') {
            try { parsedOptions = JSON.parse(parsedOptions); } catch(e) {}
          }
          
          const correctOptionStr = (parsedOptions && parsedOptions[q.correct_option_index]) ? parsedOptions[q.correct_option_index].toString().trim() : '';
          
          if (userAnsStr === correctAns || (correctOptionStr !== '' && userAnsStr === correctOptionStr)) {
            isCorrect = true;
            pointsEarned = pts;
          } else if (!isNaN(parseInt(userAns)) && q.correct_option_index !== undefined && q.correct_option_index !== null) {
            if (parseInt(userAns) === parseInt(q.correct_option_index)) {
              isCorrect = true;
              pointsEarned = pts;
            }
          }
        }
      }

      totalPointsEarned += pointsEarned;

      attemptsToInsert.push({
        user_id: userId,
        test_id: testId,
        question_id: q.id,
        user_answer: userAns ? userAns.toString() : null,
        is_correct: isCorrect,
        points_earned: pointsEarned
      });

      gradedQuestions.push({
        ...q,
        points: pts,
        is_correct: isCorrect,
        user_answer: userAns,
        correct: (q.question_type === 'written' || q.question_type === 'multipart_ab') ? q.correct_answer_text : ((typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options)[q.correct_option_index]; } catch(e) { return ''; } })() : (q.options ? q.options[q.correct_option_index] : '')))
      });
    }

    const finalScore = Number(totalPointsEarned.toFixed(1));

    // 4. Update session score and insert attempts
    await supabaseAdmin.from('test_sessions').update({ score: finalScore }).eq('id', sessionId);
    if (attemptsToInsert.length > 0) {
      await supabaseAdmin.from('attempts').insert(attemptsToInsert);
    }

    res.json({ success: true, score: finalScore, gradedQuestions });
  } catch (error) {
    console.error('Submit Exam Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/start-practice', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { questionIds, subject, difficulty, count } = req.body; 
    const userId = req.user.id;

    if (subject && count) {
      // 1. RANDOM GENERATION MODE
      const userClient = getUserSupabase(req);
      
      const diffArray = Array.isArray(difficulty) && difficulty.length > 0 ? difficulty : null;
      
      const { data: sessionId, error: rpcError } = await userClient.rpc('generate_random_practice_session', { 
        p_subject: subject, 
        p_difficulties: diffArray, 
        p_limit: count 
      });

      if (rpcError || !sessionId) {
        console.error('Session generation failed:', rpcError);
        return res.status(500).json({ error: 'Amaliyot yaratishda xatolik yuz berdi' });
      }

      return res.json({ success: true, sessionId });
    }

    // 2. RETRY MISTAKES MODE (requires explicit valid questionIds)
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'questionIds array is required' });
    }

    if (questionIds.length > 200) {
      return res.status(400).json({ error: 'Too many questions (max 200)' });
    }

    // Validate questionIds
    const { data: validQs, error: validErr } = await supabaseAdmin
      .from('questions')
      .select('id, test_id')
      .in('id', questionIds)
      .in('status', ['approved', 'published']);

    if (validErr || !validQs || validQs.length === 0) {
       return res.status(400).json({ error: 'Invalid question IDs' });
    }

    const testIds = [...new Set(validQs.map(q => q.test_id))];
    const { data: validTests } = await supabaseAdmin
      .from('mock_tests')
      .select('id')
      .in('id', testIds);
    
    if (!validTests) return res.status(400).json({ error: 'Invalid test IDs' });
    
    const validTestIds = new Set(validTests.map(t => t.id));
    const finalQids = validQs.filter(q => validTestIds.has(q.test_id)).map(q => q.id);

    if (finalQids.length === 0) return res.status(400).json({ error: 'No valid questions found' });

    // 2. Atomically Create Practice Session via RPC
    const userClient = getUserSupabase(req);
    const { data: sessionId, error: rpcError } = await userClient.rpc('create_practice_session', { p_question_ids: finalQids });

    if (rpcError || !sessionId) {
      console.error('Session creation failed:', rpcError);
      return res.status(500).json({ error: 'Failed to assign practice questions' });
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Start Practice Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/check-answer', authMiddleware, strictLimiter, async (req, res) => {
  try {
    const { sessionId, questionId, userAnswer } = req.body;
    const userId = req.user.id;

    if (!sessionId || !questionId || userAnswer === undefined) {
      return res.status(400).json({ error: 'sessionId, questionId, and userAnswer required' });
    }

    // 1. Atomically execute checking via secure RPC
    const userClient = getUserSupabase(req);
    const { data: result, error: rpcError } = await userClient.rpc('check_practice_answer', {
      p_session_id: sessionId,
      p_question_id: questionId,
      p_user_answer: userAnswer.toString()
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('Invalid') || msg.includes('expired') || msg.includes('unauthorized')) return res.status(403).json({ error: msg });
      if (msg.includes('Maximum attempts') || msg.includes('already answered')) return res.status(429).json({ error: msg });
      if (msg.includes('not found')) return res.status(404).json({ error: msg });
      
      console.error('Check Answer RPC Error:', rpcError);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.json(result);

  } catch (error) {
    console.error('Check Answer Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/grade-answer', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { userAnswer, correctAnswer, questionText } = req.body;

    if (!userAnswer || !correctAnswer) {
      return res.status(400).json({ error: 'userAnswer and correctAnswer are required' });
    }

    // Limit input lengths to prevent prompt injection abuse
    if (userAnswer.length > 2000 || correctAnswer.length > 2000 || (questionText && questionText.length > 5000)) {
      return res.status(400).json({ error: 'Input too long' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    const systemInstruction = `You are a strict but fair A-Level Mathematics examiner. Evaluate if the student's answer is mathematically equivalent to the correct answer. A-Level Math often accepts simplified fractions, decimals, or different algebraic forms if mathematically identical. If it is correct, return "CORRECT". If it is wrong, return "INCORRECT". Format your response EXACTLY as a JSON object with two keys:
{
  "isCorrect": boolean,
  "feedback": "A short 1-sentence explanation of why it is right or wrong, helpful to the student."
}`;

    const userMessage = `Question:
${questionText || 'A math problem'}

Official correct answer/key:
${correctAnswer}

Student answer:
${userAnswer}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const text = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON output from Gemini
    try {
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonResponse = JSON.parse(cleanedText);
      res.json(jsonResponse);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", text);
      const isCorrect = text.toUpperCase().includes('"ISCORRECT": TRUE') || text.toUpperCase().includes('CORRECT');
      res.json({ isCorrect, feedback: text });
    }

  } catch (error) {
    console.error("AI Grading Error:", error);
    res.status(500).json({ error: 'Internal server error during grading' });
  }
});

app.post('/api/grade-essay', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { topic, essay, lang, essayType } = req.body;

    if (!essay) {
      return res.status(400).json({ error: 'Essay is required' });
    }

    // Limit input lengths to prevent abuse
    if (essay.length > 20000) {
      return res.status(400).json({ error: 'Essay too long (max 20,000 characters)' });
    }
    if (topic && topic.length > 1000) {
      return res.status(400).json({ error: 'Topic too long' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
    }

    let criteriaPrompt = '';
    if (essayType === 'ielts_task1') {
      criteriaPrompt = `Evaluate the essay STRICTLY based on the official IELTS Writing Task 1 Band Descriptors: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. Provide a band score from 1.0 to 9.0 (e.g., '6.5').`;
    } else if (essayType === 'ielts_task2') {
      criteriaPrompt = `Evaluate the essay STRICTLY based on the official IELTS Writing Task 2 Band Descriptors: Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. Provide a band score from 1.0 to 9.0 (e.g., '7.0').`;
    } else if (essayType === 'onatili') {
      criteriaPrompt = `Evaluate the essay based on the Uzbekistan National Certificate (Milliy Sertifikat) criteria for Native Language. You must grade out of 24 points total based on: Imlo (Spelling), Punktuatsiya (Punctuation), Uslub (Style), and Fikrning mantiqiyligi (Logic). Your score MUST be a number out of 24 (e.g., '21.5', '18').`;
    } else if (essayType === 'university') {
      criteriaPrompt = `Evaluate the essay based on University Admission and Academic standards: Thesis clarity, Argumentation, Structure, and Academic vocabulary. Provide a grade or score fitting for university admissions (e.g., 'Strong', 'Acceptable', 'Needs Improvement').`;
    } else {
      criteriaPrompt = `Evaluate the essay based on grammar, vocabulary, coherence, and task achievement.`;
    }

    const systemPrompt = `You are an expert examiner.
${criteriaPrompt}

Format your response EXACTLY as a JSON object with these keys:
{
  "score": "The estimated score (For Ona tili, MUST be a number out of 24 like '18.5')",
  "feedback": "Detailed feedback summarizing strengths and weaknesses.",
  "mistakes": [
    {
      "original": "incorrect word/phrase",
      "correction": "corrected word/phrase",
      "explanation": "Why it was wrong"
    }
  ]
}

Please respond in ${lang === 'uz' ? 'Uzbek' : 'Russian'}. You must return a valid JSON object.`;

    const userMessage = `Topic: "${topic || 'No specific topic provided'}"
Essay:
"""
${essay}
"""`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const text = data.choices[0].message.content;
    const jsonResponse = JSON.parse(text);

    // Ona tili score mapping (24 -> 75)
    if (essayType === 'onatili' && jsonResponse.score) {
      // Extract numeric value from "18.5" or "18.5/24"
      const rawMatch = String(jsonResponse.score).match(/([0-9]+[\.,]?[0-9]*)/);
      if (rawMatch) {
        let rawScore = parseFloat(rawMatch[0].replace(',', '.'));
        if (rawScore > 24) rawScore = 24;
        
        // Formula: 75 - ((24 - rawScore) * 2)
        let finalScore = 75 - ((24 - rawScore) * 2);
        if (finalScore < 0) finalScore = 0;
        
        jsonResponse.score = `${finalScore} / 75 ball`;
        jsonResponse.feedback = `(Aslida ${rawScore}/24 baholangan, tizimga ko'ra ${finalScore} ballga tenglashtirildi)\n\n` + jsonResponse.feedback;
      }
    } else if (essayType.startsWith('ielts_') && jsonResponse.score) {
       if (!String(jsonResponse.score).toLowerCase().includes('ielts')) {
          jsonResponse.score = `IELTS ${jsonResponse.score}`;
       }
    }

    res.json(jsonResponse);

  } catch (error) {
    console.error("AI Essay Grading Error:", error);
    res.status(500).json({ error: 'Internal server error during essay grading' });
  }
});

app.post('/api/analyze-progress', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { testHistory, lang } = req.body;
    
    if (!testHistory || testHistory.length === 0) {
      return res.json({ analysis: lang === 'uz' ? "Test natijalari yetarli emas." : "Недостаточно результатов тестов." });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
    }

    const systemPrompt = `You are an AI Analyst for an exam prep app. 
Analyze the student's recent test history and identify their weakest subjects or topics.
Write a professional, encouraging paragraph analyzing their weaknesses and giving 1-2 actionable tips on what to study next.
Format your response EXACTLY as a JSON object:
{
  "analysis": "Your detailed feedback paragraph"
}
Respond in ${lang === 'uz' ? 'Uzbek' : 'Russian'} language. You must output valid JSON.`;

    const userMessage = `Test history data:
${JSON.stringify(testHistory)}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const text = data.choices[0].message.content;
    const jsonResponse = JSON.parse(text);
    res.json(jsonResponse);

  } catch (error) {
    console.error("AI Progress Analysis Error:", error);
    res.status(500).json({ error: 'Internal server error during progress analysis' });
  }
});

app.post('/api/ai-tutor', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { history, message, lang, userContext } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Limit input to prevent abuse
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long' });
    }
    if (history && history.length > 50) {
      return res.status(400).json({ error: 'Conversation history too long' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
    }

    const systemPrompt = `You are a friendly and encouraging AI personal tutor for a student preparing for university entrance exams (DTM / Milliy Sertifikat) in Uzbekistan. 
Respond in ${lang === 'uz' ? 'Uzbek' : 'Russian'}. 
Help the student solve problems, explain concepts clearly step-by-step, and provide motivation. Do not give just the final answer; guide them to it. Use LaTeX for math.
Student context: ${userContext ? JSON.stringify(userContext) : 'No context provided'}`;

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.content
    }));
    formattedHistory.push({ role: 'user', content: message });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemPrompt }, ...formattedHistory],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error("AI Tutor Error:", error);
    res.status(500).json({ error: 'Internal server error during AI Tutor response' });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
