// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Пожалуйста, введите ваш email');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setMessage('На ваш email отправлена инструкция по восстановлению пароля.');
    } catch (error) {
      console.error('Ошибка при запросе восстановления пароля:', error.message);
      setError('Не удалось отправить инструкцию. Проверьте правильность email.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <div className="m-auto w-full max-w-md p-5 sm:p-8 bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-500">ФСП</h1>
          <p className="text-gray-400 mt-2">Федерация Спортивного Программирования</p>
          <h2 className="text-xl sm:text-2xl font-semibold mt-4 sm:mt-6">Восстановление пароля</h2>
        </div>
        
        {message && (
          <div className="mb-6 p-4 bg-green-900 text-white rounded-lg">
            <p>{message}</p>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-blue-500 hover:underline">
                Вернуться на страницу входа
              </Link>
            </div>
          </div>
        )}
        
        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                placeholder="Введите ваш email"
              />
              <p className="text-sm text-gray-400 mt-2">
                Мы отправим инструкцию по восстановлению пароля на указанный email.
              </p>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-900 text-white text-sm rounded">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить инструкцию'}
            </button>
            
            <div className="mt-6 text-center">
              <Link to="/login" className="text-blue-500 hover:underline">
                Вернуться на страницу входа
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;