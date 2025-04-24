// src/App.jsx с добавленным маршрутом для управления заявками
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// Импорт компонентов
import Registration from './components/Registration';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CompetitionsList from './components/CompetitionsList';
import CompetitionCreate from './components/CompetitionCreate';
import CompetitionDetails from './components/CompetitionDetails';
import ApplicationsManagement from './components/ApplicationsManagement'; // Новый компонент
import TeamsList from './components/TeamsList'; 
import TeamDetails from './components/TeamDetails';
import Profile from './components/Profile';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import CompetitionEdit from './components/CompetitionEdit';
import CompetitionResultsForm from './components/CompetitionResultsForm';

// Компонент для защищенных маршрутов
const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверка авторизации пользователя
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoading(false);
    };
    
    checkUser();
    
    // Подписка на изменения статуса авторизации
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        setLoading(false);
      }
    );
    
    return () => {
      // Отписка при размонтировании компонента
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  if (loading) {
    // Отображение загрузки
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }
  
  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Если пользователь авторизован, отображаем запрошенную страницу
  return children;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/register" element={<Registration />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/competitions/:id/results" element={<CompetitionResultsForm />} />
        
        {/* Защищенные маршруты */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        
        <Route path="/competitions" element={
          <PrivateRoute>
            <CompetitionsList />
          </PrivateRoute>
        } />
        
        <Route path="/competitions/create" element={
          <PrivateRoute>
            <CompetitionCreate />
          </PrivateRoute>
        } />
        
        <Route path="/competitions/:id" element={
          <PrivateRoute>
            <CompetitionDetails />
          </PrivateRoute>
        } />
        
        {/* Новый маршрут для управления заявками */}
        <Route path="/competitions/:id/applications" element={
          <PrivateRoute>
            <ApplicationsManagement />
          </PrivateRoute>
        } />
        
        <Route path="/teams" element={
          <PrivateRoute>
            <TeamsList />
          </PrivateRoute>
        } />
        
        <Route path="/teams/:id" element={
          <PrivateRoute>
            <TeamDetails />
          </PrivateRoute>
        } />
        
        <Route path="/profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
        
        {/* Добавляем маршрут для редактирования соревнования */}
        <Route path="/competitions/:id/edit" element={
          <PrivateRoute>
            <CompetitionEdit />
          </PrivateRoute>
        } />
        
        {/* Перенаправление с главной страницы */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Обработка несуществующих маршрутов */}
        <Route path="*" element={
          <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4">404</h1>
              <p className="text-lg mb-6">Страница не найдена</p>
              <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                На главную
              </a>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
};

export default App;