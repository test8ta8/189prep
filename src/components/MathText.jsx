import React from 'react';
import katex from 'katex';

// Heuristic to wrap bare LaTeX in $ $
function fixMissingDollarSigns(text) {
  if (!text) return '';
  if (text.includes('$')) return text; 
  
  const mathRegex = /(\\int|\\frac|\\sum|\\sqrt|\\lim|\\log|\\alpha|\\beta|\\gamma|\\theta|\\[a-zA-Z]+_[a-zA-Z0-9]+|\^[0-9]+|\\cdot)/;
  if (mathRegex.test(text)) {
    if (text.length < 50 && !text.includes('?')) {
      return `$${text}$`;
    }
    // Attempt to wrap the math part before common Uzbek text
    let replaced = text.replace(/((?:\\int|\\lim|\\sum|\\frac|\\log|\\sqrt).*?)(?=\s+(?:integralni|funksiyaning|ni|qiymatini|toping|hisoblang|bo'lsa|qanday|qaysi|$))/i, '$$$1$$');
    if (replaced !== text) return replaced;
  }
  return text;
}

export default function MathText({ children, style, className }) {
  if (!children) return null;
  
  const rawText = typeof children === 'string' ? children : String(children);
  const fixedText = fixMissingDollarSigns(rawText);

  // Split text by $$ ... $$ and $ ... $
  const parts = fixedText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  
  return (
    <div className={`math-text-container ${className || ''}`} style={{ ...style, lineHeight: '1.6', display: 'inline-block', width: '100%' }}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } else {
          return <span key={index} dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br/>') }} />;
        }
      })}
    </div>
  );
}
