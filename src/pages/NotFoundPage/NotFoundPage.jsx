import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { AlertTriangle, Home } from 'lucide-react';
import './NotFoundPage.css';

export default function NotFoundPage({ lang }) {
  useDocumentTitle(lang === 'uz' ? 'Sahifa topilmadi' : 'Страница не найдена');

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <AlertTriangle size={64} className="not-found-icon" />
        <h1 className="not-found-title">404</h1>
        <h2 className="not-found-subtitle">
          {lang === 'uz' ? 'Sahifa topilmadi' : 'Страница не найдена'}
        </h2>
        <p className="not-found-text">
          {lang === 'uz' 
            ? 'Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko\'chirilgan.' 
            : 'Извините, запрашиваемая страница не существует или была перемещена.'}
        </p>
        <Link to={ROUTES.HOME} className="btn-primary not-found-btn">
          <Home size={18} />
          {lang === 'uz' ? 'Bosh sahifaga qaytish' : 'Вернуться на главную'}
        </Link>
      </div>
    </div>
  );
}
