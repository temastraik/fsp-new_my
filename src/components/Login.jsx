// src/components/Login.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Пожалуйста, введите email и пароль');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      
      if (error) throw error;
      
      // Здесь можно добавить перенаправление на главную страницу или дашборд
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error('Ошибка при входе:', error.message);
      setError('Неверный email или пароль');
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
          <h2 className="text-xl sm:text-2xl font-semibold mt-4 sm:mt-6">Вход в систему</h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              placeholder="example@mail.ru"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-1">Пароль</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              placeholder="Ваш пароль"
            />
            <div className="flex justify-end mt-1">
              <Link to="/forgot-password" className="text-sm text-blue-500 hover:underline">
                  Забыли пароль?
              </Link>
            </div>
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
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-400">
            Еще нет аккаунта?{' '}
            <Link to="/register" className="text-blue-500 hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;