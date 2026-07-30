export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  RESET_PASSWORD: '/reset-password',
  LEGAL: '/legal/:type',
  
  // Protected Workspace Routes
  DASHBOARD: '/dashboard',
  MOCKS: '/mocks',
  PROGRESS: '/progress',
  PROFILE: '/profile',
  PRACTICE_ARENA: '/practice-arena',
  ESSAY_REVIEW: '/essay-review',
  AI_TUTOR: '/ai-tutor',
  PRICING: '/pricing',
  BOOKMARKS: '/bookmarks',
  CUSTOM_TEST: '/custom-test',
  MISTAKES: '/mistakes',
  
  // Protected Action Routes
  EXAM: '/exam',
  EXAM_WITH_ID: '/exam/:id', 
  
  // Admin Routes
  ADMIN: '/admin/*',
};
