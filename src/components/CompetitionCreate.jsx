// src/components/CompetitionCreate.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { canCreateFederalCompetition, canCreateRegionalCompetition } from '../utils/roleUtils';

// Компонент ввода даты и времени
const CustomDateTimeInput = ({ value, onChange, placeholder, required = false }) => {
  const dateValue = value ? new Date(value) : null;

  const formatDate = (date) => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const handleChange = (e) => {
    try {
      if (!e.target.value) {
        onChange(null);
        return;
      }
      const newDate = new Date(e.target.value);
      if (!isNaN(newDate.getTime())) {
        onChange(newDate.toISOString());
      }
    } catch (error) {
      console.error('Ошибка при парсинге даты:', error);
    }
  };

  const toDateTimeFormat = (date) => {
    if (!date) return '';
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);
  };

  return (
    <div className="relative">
      <input
        type="datetime-local"
        value={dateValue ? toDateTimeFormat(dateValue) : ''}
        onChange={handleChange}
        className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-white"
        placeholder={placeholder}
        required={required}
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
};

// Основной компонент создания соревнования
const CompetitionCreate = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [disciplines, setDisciplines] = useState([]);
  const [regions, setRegions] = useState([]);
  const [error, setError] = useState(null);

  // Состояние формы
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discipline_id: '',
    type: 'открытое',
    region_id: null,
    registration_start_date: '',
    registration_end_date: '',
    start_date: '',
    end_date: '',
    max_participants_or_teams: '',
    participation_type: 'смешанное',
    status: 'черновик'
  });

  // Получение роли пользователя при загрузке
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);

      if (data?.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role, region_id')
          .eq('id', data.user.id)
          .single();

        if (!userError && userData) {
          if (userData.role === 'regional_rep' && userData.region_id) {
            setFormData(prevData => ({
              ...prevData,
              region_id: userData.region_id
            }));
          }
          setUserRole(userData.role);
        }
      }
    };

    fetchUser();
  }, []);

  // Функция для проверки и создания профиля пользователя
  const ensureUserProfile = async (currentUser) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', currentUser.id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        console.log('Профиль пользователя не найден, создаем новый');
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: currentUser.id,
              email: currentUser.email,
              full_name: currentUser.user_metadata?.full_name || '',
              created_at: new Date()
            }
          ]);

        if (insertError) {
          console.error('Ошибка при создании профиля пользователя:', insertError);
          setError('Не удалось создать профиль пользователя. Пожалуйста, перейдите в раздел "Профиль" и обновите данные.');
          return false;
        }
        return true;
      } else if (userError) {
        console.error('Ошибка при проверке профиля пользователя:', userError);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Ошибка при проверке/создании профиля:', error);
      return false;
    }
  };

  // Загрузка справочных данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: disciplinesData, error: disciplinesError } = await supabase
          .from('disciplines')
          .select('id, name');

        if (disciplinesError) throw disciplinesError;
        setDisciplines(disciplinesData || []);

        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name');

        if (regionsError) throw regionsError;
        setRegions(regionsData || []);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error.message);
        setError('Не удалось загрузить необходимые данные. Попробуйте позже.');
      }
    };

    fetchData();
  }, []);

  // Обработчик изменения полей
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'type') {
      if (value === 'федеральное' && !canCreateFederalCompetition(userRole)) {
        setError('Только администраторы ФСП могут создавать федеральные соревнования');
        return;
      }

      if (value === 'региональное' && userRole === 'regional_rep' && user) {
        supabase
          .from('users')
          .select('region_id')
          .eq('id', user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data && data.region_id) {
              setFormData({
                ...formData,
                type: value,
                region_id: data.region_id
              });
            } else {
              setFormData({
                ...formData,
                type: value,
                region_id: null
              });
            }
          });
        return;
      }

      setFormData({
        ...formData,
        [name]: value,
        region_id: value !== 'региональное' ? null : formData.region_id
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Обработчик изменения дат
  const handleDateChange = (value, field) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  // Обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Попытка создания соревнования:', formData);

      if (formData.type === 'федеральное' && !canCreateFederalCompetition(userRole)) {
        throw new Error('Только администраторы ФСП могут создавать федеральные соревнования');
      }

      if (formData.type === 'региональное' && !canCreateRegionalCompetition(userRole)) {
        throw new Error('Только региональные представители и администраторы ФСП могут создавать региональные соревнования');
      }

      const requiredFields = [
        'name', 'discipline_id', 'type',
        'registration_start_date', 'registration_end_date',
        'start_date', 'end_date'
      ];

      if (formData.type === 'региональное' && !formData.region_id) {
        throw new Error('Необходимо выбрать регион для регионального соревнования');
      }

      for (const field of requiredFields) {
        if (!formData[field]) {
          throw new Error(`Поле "${field}" обязательно для заполнения`);
        }
      }

      const profileExists = await ensureUserProfile(user);
      if (!profileExists) {
        throw new Error('Не удалось подтвердить ваш профиль. Возможно, нужно обновить профильные данные.');
      }

      console.log('Отправка данных в Supabase:', {
        ...formData,
        organizer_user_id: user.id,
        created_at: new Date().toISOString()
      });

      const { data, error } = await supabase
        .from('competitions')
        .insert([
          {
            name: formData.name,
            description: formData.description,
            discipline_id: formData.discipline_id,
            type: formData.type,
            region_id: formData.region_id === '' ? null : formData.region_id,
            registration_start_date: formData.registration_start_date,
            registration_end_date: formData.registration_end_date,
            start_date: formData.start_date,
            end_date: formData.end_date,
            max_participants_or_teams: formData.max_participants_or_teams || null,
            organizer_user_id: user.id,
            status: formData.status,
            created_at: new Date().toISOString(),
            participation_type: formData.participation_type
          }
        ])
        .select();

      if (error) {
        console.error('Ошибка при создании соревнования:', error);
        throw new Error(`Не удалось создать соревнование: ${error.message}`);
      }

      console.log('Соревнование успешно создано:', data[0]);
      alert('Соревнование успешно создано!');
      navigate(`/competitions/${data[0].id}`);
    } catch (error) {
      console.error('Ошибка при создании соревнования:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Валидация дат
  const validateDates = () => {
    const regStart = new Date(formData.registration_start_date);
    const regEnd = new Date(formData.registration_end_date);
    const compStart = new Date(formData.start_date);
    const compEnd = new Date(formData.end_date);

    if (!formData.registration_start_date || !formData.registration_end_date ||
        !formData.start_date || !formData.end_date) {
      return null;
    }

    if (isNaN(regStart.getTime()) || isNaN(regEnd.getTime()) ||
        isNaN(compStart.getTime()) || isNaN(compEnd.getTime())) {
      return 'Введены некорректные даты';
    }

    if (regEnd <= regStart) {
      return 'Дата окончания регистрации должна быть позже даты начала регистрации';
    }

    if (compStart <= regStart) {
      return 'Дата начала соревнования должна быть позже даты начала регистрации';
    }

    if (compEnd <= compStart) {
      return 'Дата окончания соревнования должна быть позже даты начала соревнования';
    }

    return null;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-0">Создание соревнования</h1>
          <Link
            to="/competitions"
            className="text-gray-300 hover:text-white mb-4 sm:mb-0"
          >
            ← Вернуться к списку
          </Link>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Основная информация</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Название соревнования *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Введите название"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Дисциплина *</label>
                  <select
                    name="discipline_id"
                    value={formData.discipline_id}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Выберите дисциплину</option>
                    {disciplines.map(discipline => (
                      <option key={discipline.id} value={discipline.id}>
                        {discipline.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-gray-300 mb-1">Описание</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  rows="4"
                  placeholder="Введите описание соревнования"
                ></textarea>
              </div>
            </div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Тип соревнования</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Тип *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="открытое">Открытое</option>
                    <option value="региональное">Региональное</option>
                    <option value="федеральное">Федеральное</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Формат участия *</label>
                  <select
                    name="participation_type"
                    value={formData.participation_type}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="командное">Только командное участие</option>
                    <option value="индивидуальное">Только индивидуальное участие</option>
                    <option value="смешанное">Командное и индивидуальное участие</option>
                  </select>
                </div>
                {formData.type === 'региональное' && (
                  <div>
                    <label className="block text-gray-300 mb-1">Регион *</label>
                    <select
                      name="region_id"
                      value={formData.region_id || ''}
                      onChange={handleChange}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      required
                    >
                      <option value="">Выберите регион</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-gray-300 mb-1">Максимум участников/команд</label>
                  <input
                    type="number"
                    name="max_participants_or_teams"
                    value={formData.max_participants_or_teams}
                    onChange={handleChange}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Без ограничений"
                    min="1"
                  />
                </div>
              </div>
            </div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Даты</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Начало регистрации *</label>
                  <CustomDateTimeInput
                    value={formData.registration_start_date}
                    onChange={(value) => handleDateChange(value, 'registration_start_date')}
                    placeholder="Выберите дату и время"
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Конец регистрации *</label>
                  <CustomDateTimeInput
                    value={formData.registration_end_date}
                    onChange={(value) => handleDateChange(value, 'registration_end_date')}
                    placeholder="Выберите дату и время"
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Начало соревнования *</label>
                  <CustomDateTimeInput
                    value={formData.start_date}
                    onChange={(value) => handleDateChange(value, 'start_date')}
                    placeholder="Выберите дату и время"
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Конец соревнования *</label>
                  <CustomDateTimeInput
                    value={formData.end_date}
                    onChange={(value) => handleDateChange(value, 'end_date')}
                    placeholder="Выберите дату и время"
                    required={true}
                  />
                </div>
              </div>
              {validateDates() && (
                <div className="mt-2 p-2 bg-red-900 text-white text-sm rounded">
                  {validateDates()}
                </div>
              )}
            </div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Статус публикации</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-4">
                <label className="inline-flex items-center mb-2 sm:mb-0">
                  <input
                    type="radio"
                    name="status"
                    value="черновик"
                    checked={formData.status === 'черновик'}
                    onChange={handleChange}
                    className="form-radio text-blue-500"
                  />
                  <span className="ml-2">Сохранить как черновик</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="опубликовано"
                    checked={formData.status === 'опубликовано'}
                    onChange={handleChange}
                    className="form-radio text-blue-500"
                  />
                  <span className="ml-2">Опубликовать сразу</span>
                </label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
              <Link
                to="/competitions"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition text-center"
              >
                Отмена
              </Link>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                disabled={loading}
              >
                {loading ? 'Создание...' : 'Создать соревнование'}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-900 text-white rounded">
                <p className="font-semibold">Ошибка:</p>
                <p>{error}</p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompetitionCreate;