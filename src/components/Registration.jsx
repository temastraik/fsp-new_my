// src/components/Registration.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

const Registration = () => {
  // Состояния для формы
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    region_id: '',
    bio: '',
    role: 'athlete' // По умолчанию - спортсмен
  });
  
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  
  // Загрузка списка регионов из базы данных
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const { data, error } = await supabase
          .from('regions')
          .select('id, name');
          
        if (error) throw error;
        setRegions(data || []);
      } catch (error) {
        console.error('Ошибка при загрузке регионов:', error.message);
      }
    };


    
    fetchRegions();
  }, []);
  
  // Обработчик изменения полей формы
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Валидация первого шага (основная информация)
  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.full_name.trim()) 
      newErrors.full_name = 'Введите ваше полное имя';
      
    if (!formData.email.trim()) {
      newErrors.email = 'Введите ваш email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email некорректен';
    }
    
    if (!formData.password) {
      newErrors.password = 'Введите пароль';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать не менее 8 символов';
    }
    
    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Пароли не совпадают';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Валидация второго шага (дополнительная информация)
  const validateStep2 = () => {
    const newErrors = {};
    
    if (!formData.region_id) 
      newErrors.region_id = 'Выберите регион';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Переход к следующему шагу
  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };
  
  // Возврат к предыдущему шагу
  const handlePrevStep = () => {
    setStep(step - 1);
  };
  
  // Отправка формы регистрации
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (step !== 3) return;
    
    setLoading(true);
    
    try {
      // Регистрация пользователя через Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      });
      
      if (authError) throw authError;
      
      console.log('Данные авторизации:', authData);
      
      // Проверка, что пользователь успешно создан
      if (!authData?.user || !authData.user.id) {
        throw new Error('Не удалось создать пользователя');
      }
      
      // Сохранение дополнительных данных пользователя в таблицу users
      const userData = {
        id: authData.user.id,
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        region_id: formData.region_id ? parseInt(formData.region_id) : null,
        bio: formData.bio,
        created_at: new Date()
      };
      
      console.log('Данные пользователя для сохранения:', userData);
      
      const { error: profileError } = await supabase
        .from('users')
        .insert([userData]);
        
      if (profileError) {
        console.error('Ошибка при сохранении профиля:', profileError);
        
        // Если произошла ошибка при сохранении профиля, удаляем созданного пользователя
        await supabase.auth.admin.deleteUser(authData.user.id);
        
        throw new Error(`Ошибка при сохранении профиля: ${profileError.message}`);
      }
      
      alert('Регистрация успешно завершена! Проверьте вашу почту для подтверждения аккаунта.');
      // Перенаправление на страницу входа
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      setErrors({
        submit: error.message
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <div className="m-auto w-full max-w-md p-5 sm:p-8 bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-500">ФСП</h1>
          <p className="text-gray-400 mt-2">Федерация Спортивного Программирования</p>
        </div>
        
        {/* Индикатор прогресса */}
        <div className="mb-6">
          <div className="flex justify-center relative">
            {/* Линия прогресса */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-600 -z-10"></div>
            <div 
            className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -z-10" 
            style={{ 
              width: `${(step - 1) * 50}%`,
              transition: 'width 0.3s ease'
            }}
            ></div>
            
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex flex-col items-center mx-8">
                <div
                className={`w-8 h-8 rounded-full flex items-center justify-center relative ${
                  step >= stepNumber ? 'bg-blue-500' : 'bg-gray-600'
                }`}
                >
                  {stepNumber}
                  </div>
                  <span className="text-xs text-gray-400 mt-2">
                    {stepNumber === 1 ? 'Основное' : 
                    stepNumber === 2 ? 'Профиль' : 'Завершение'}
                    </span>
                    </div>
                  ))}
                  </div>
                </div>
        
        {/* Форма регистрации */}
        <form onSubmit={handleSubmit}>
          {/* Шаг 1: Основная информация */}
          {step === 1 && (
            <div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Полное имя</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Иванов Иван Иванович"
                />
                {errors.full_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>
                )}
              </div>
              
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
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Пароль</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Минимум 8 символов"
                />
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-300 mb-1">Подтверждение пароля</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Повторите пароль"
                />
                {errors.confirm_password && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirm_password}</p>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Далее
              </button>
            </div>
          )}
          
          {/* Шаг 2: Дополнительная информация */}
          {step === 2 && (
            <div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Регион</label>
                <select
                  name="region_id"
                  value={formData.region_id}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="">Выберите регион</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
                {errors.region_id && (
                  <p className="text-red-500 text-xs mt-1">{errors.region_id}</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Роль</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="athlete">Спортсмен</option>
                  <option value="regional_rep">Региональный представитель</option>
                  <option value="fsp_admin">Администратор ФСП</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-300 mb-1">О себе</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  rows="3"
                  placeholder="Расскажите о своем опыте в программировании..."
                ></textarea>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="w-full sm:w-1/2 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-1/2 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Далее
                </button>
              </div>
            </div>
          )}
          
          {/* Шаг 3: Подтверждение и завершение */}
          {step === 3 && (
            <div>
              <div className="mb-6 bg-gray-700 p-4 rounded">
                <h3 className="text-lg font-medium mb-2">Подтверждение данных</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                  <span className="text-gray-400">Имя:</span>
                  <span>{formData.full_name}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                  <span className="text-gray-400">Email:</span>
                  <span>
                    {formData.email.length > 14 
                    ? `${formData.email.substring(0, 14)}...` 
                    : formData.email}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                  <span className="text-gray-400">Регион:</span>
                  <span>
                    {regions.find(r => r.id === parseInt(formData.region_id))?.name || '-'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                  <span className="text-gray-400">Роль:</span>
                  <span>
                    {formData.role === 'athlete' ? 'Спортсмен' : 
                     formData.role === 'regional_rep' ? 'Региональный представитель' : 'Администратор ФСП'}
                  </span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="form-checkbox h-4 w-4 text-blue-500" 
                    required
                  />
                  <span className="ml-2 text-sm text-gray-400">
                    Я согласен с условиями использования и политикой конфиденциальности
                  </span>
                </label>
              </div>
              
              {errors.submit && (
                <div className="mb-4 p-2 bg-red-900 text-white text-sm rounded">
                  {errors.submit}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="w-full sm:w-1/2 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                  disabled={loading}
                >
                  Назад
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-1/2 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  disabled={loading}
                >
                  {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
              </div>
            </div>
          )}
        </form>
        
        {/* Ссылка на вход */}
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-400">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-blue-500 hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
export default Registration;