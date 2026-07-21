import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/parse-pdf', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF provided' });
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/detect-boxes', async (req, res) => {
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parse-cropped', async (req, res) => {
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Mock Webhook for Payme/Click
app.post('/api/payment/callback', async (req, res) => {
  try {
    const { transaction_id, status } = req.body;
    
    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    // 1. Get the pending transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'paid') {
      return res.json({ message: 'Transaction already paid' });
    }

    if (status === 'success') {
      // 2. Mark transaction as paid
      await supabase
        .from('transactions')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', transaction_id);

      // 3. Extend user subscription
      const monthsToAdd = transaction.plan_months || 1;
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('subscription_until')
        .eq('id', transaction.user_id)
        .single();

      let currentSubEnd = new Date();
      if (userProfile?.subscription_until && new Date(userProfile.subscription_until) > currentSubEnd) {
        currentSubEnd = new Date(userProfile.subscription_until);
      }
      
      currentSubEnd.setMonth(currentSubEnd.getMonth() + monthsToAdd);

      await supabase
        .from('profiles')
        .update({ subscription_until: currentSubEnd.toISOString() })
        .eq('id', transaction.user_id);

      return res.json({ message: 'Payment successful, subscription activated!' });
    } else {
      // Handle failed/cancelled
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', transaction_id);

      return res.json({ message: 'Payment cancelled' });
    }

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai-tutor', async (req, res) => {
  try {
    const { history, message, lang, userContext } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
    }

    const contextStr = userContext ? `\n\nStudent Progress Context:\n${JSON.stringify(userContext)}` : '';

    const systemPrompt = `You are an AI Tutor for a test preparation app called 189PREP.
You help students understand their mistakes and explain concepts clearly.
${contextStr}
Respond in ${lang === 'uz' ? 'Uzbek' : 'Russian'}. Keep it concise, helpful, and use simple markdown (**bold** for emphasis, no complex html).`;

    const validHistory = (history || []).filter((msg, idx) => !(idx === 0 && msg.role === 'model'));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...validHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const reply = data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("AI Tutor Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/grade-answer', async (req, res) => {
  try {
    const { userAnswer, correctAnswer, questionText } = req.body;

    if (!userAnswer || !correctAnswer) {
      return res.status(400).json({ error: 'userAnswer and correctAnswer are required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    const prompt = `You are a strict but fair A-Level Mathematics examiner.
The student was asked this question:
"""
${questionText || 'A math problem'}
"""
The official correct answer/key is:
"""
${correctAnswer}
"""
The student wrote:
"""
${userAnswer}
"""
Evaluate if the student's answer is mathematically equivalent to the correct answer. 
A-Level Math often accepts simplified fractions, decimals, or different algebraic forms if mathematically identical.
If it is correct, return "CORRECT". If it is wrong, return "INCORRECT".
Format your response EXACTLY as a JSON object with two keys:
{
  "isCorrect": boolean,
  "feedback": "A short 1-sentence explanation of why it is right or wrong, helpful to the student."
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
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

app.post('/api/grade-essay', async (req, res) => {
  try {
    const { topic, essay, lang, essayType } = req.body;

    if (!essay) {
      return res.status(400).json({ error: 'Essay is required' });
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
The student has written an essay on the following topic (optional): "${topic || 'No specific topic provided'}"
The essay is:
"""
${essay}
"""

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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemPrompt }],
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
        
        jsonResponse.score = \`\${finalScore} / 75 ball\`;
        jsonResponse.feedback = \`(Aslida \${rawScore}/24 baholangan, tizimga ko'ra \${finalScore} ballga tenglashtirildi)\\n\\n\` + jsonResponse.feedback;
      }
    } else if (essayType.startsWith('ielts_') && jsonResponse.score) {
       if (!String(jsonResponse.score).toLowerCase().includes('ielts')) {
          jsonResponse.score = \`IELTS \${jsonResponse.score}\`;
       }
    }

    res.json(jsonResponse);

  } catch (error) {
    console.error("AI Essay Grading Error:", error);
    res.status(500).json({ error: 'Internal server error during essay grading' });
  }
});

app.post('/api/analyze-progress', async (req, res) => {
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
Test history data:
${JSON.stringify(testHistory)}

Write a professional, encouraging paragraph analyzing their weaknesses and giving 1-2 actionable tips on what to study next.
Format your response EXACTLY as a JSON object:
{
  "analysis": "Your detailed feedback paragraph"
}
Respond in ${lang === 'uz' ? 'Uzbek' : 'Russian'} language. You must output valid JSON.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemPrompt }],
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
