// src/components/CompetitionsList.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';

const CompetitionCard = ({ competition }) => {
  const getCompetitionStatus = () => {
    if (competition.status && competition.status !== 'опубликовано' && competition.status !== 'черновик') {
      return competition.status;
    }
    
    const now = new Date();
    const regStart = new Date(competition.registration_start_date);
    const regEnd = new Date(competition.registration_end_date);
    const compStart = new Date(competition.start_date);
    const compEnd = new Date(competition.end_date);
    
    if (now < regStart) return 'скоро_открытие';
    if (now >= regStart && now <= regEnd) return 'открыта_регистрация';
    if (now > regEnd && now < compStart) return 'регистрация_закрыта';
    if (now >= compStart && now <= compEnd) return 'идет_соревнование';
    return 'завершено';
  };

  const status = getCompetitionStatus();

  return (
    <Link to={`/competitions/${competition.id}`}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 hover:shadow-lg transition">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          <h3 className="text-lg font-semibold text-white mb-2 sm:mb-0">{competition.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs inline-block sm:inline mt-1 sm:mt-0 ${
            status === 'открыта_регистрация' ? 'bg-green-900 text-green-300' :
            status === 'идет_соревнование' ? 'bg-blue-900 text-blue-300' :
            status === 'завершено' ? 'bg-gray-700 text-gray-300' :
            'bg-yellow-900 text-yellow-300'
          }`}>
            {status === 'открыта_регистрация' ? 'Регистрация открыта' :
            status === 'идет_соревнование' ? 'Идет соревнование' :
            status === 'завершено' ? 'Завершено' :
            status === 'регистрация_закрыта' ? 'Регистрация закрыта' :
            'Скоро открытие'}
          </span>
        </div>
        
        <p className="text-gray-400 text-sm mt-2">
          {competition.description?.length > 100 
            ? competition.description.substring(0, 100) + '...' 
            : competition.description}
        </p>
        
        <div className="mt-4 text-sm text-gray-500">
          <div className="flex flex-col sm:flex-row sm:justify-between">
            <span>Начало регистрации:</span>
            <span className="text-gray-400">
              {new Date(competition.registration_start_date).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between mt-1">
            <span>Конец регистрации:</span>
            <span className="text-gray-400">
              {new Date(competition.registration_end_date).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between mt-1">
            <span>Начало соревнования:</span>
            <span className="text-gray-400">
              {new Date(competition.start_date).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-wrap gap-2 mb-2 sm:mb-0">
            <span className={`px-2 py-1 bg-gray-700 rounded-full text-xs ${
              competition.type === 'открытое' ? 'text-green-400' :
              competition.type === 'региональное' ? 'text-yellow-400' :
              'text-blue-400'
            }`}>
              {competition.type === 'открытое' ? 'Открытое' :
              competition.type === 'региональное' ? 'Региональное' :
              'Федеральное'}
            </span>
            <span className="px-2 py-1 bg-gray-700 rounded-full text-xs text-purple-400">
              {competition.discipline_name || 'Общее программирование'}
            </span>
          </div>
          
          <Link 
            to={`/competitions/${competition.id}`}
            className="text-blue-500 hover:text-blue-400 text-sm"
          >
            Подробнее →
          </Link>
        </div>
      </div>
    </Link>
  );
};

const CompetitionsList = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    discipline_id: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [disciplines, setDisciplines] = useState([]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        
        if (user) {
          setUser(user);
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (!profileError && profile) {
            setUserRole(profile.role);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error.message);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchDisciplines = async () => {
      try {
        const { data, error } = await supabase
          .from('disciplines')
          .select('id, name');
        if (error) throw error;
        setDisciplines(data || []);
      } catch (error) {
        console.error('Ошибка при загрузке дисциплин:', error.message);
      }
    };
    fetchDisciplines();
  }, []);

  useEffect(() => {
    const fetchCompetitions = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('competitions')
          .select(`
            id,
            name,
            description,
            type,
            status,
            registration_start_date,
            registration_end_date,
            start_date,
            end_date,
            discipline_id,
            disciplines!inner(id, name)
          `)
          .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        const formattedCompetitions = data.map(comp => ({
          ...comp,
          discipline_id: comp.discipline_id,
          discipline_name: comp.disciplines?.name
        }));

        setCompetitions(formattedCompetitions);
      } catch (error) {
        console.error('Ошибка при загрузке соревнований:', error.message);
        setError('Не удалось загрузить список соревнований');
      } finally {
        setLoading(false);
      }
    };
    fetchCompetitions();
  }, []);

  const filteredCompetitions = competitions.filter(competition => {
    const getStatus = () => {
      if (competition.status && competition.status !== 'опубликовано' && competition.status !== 'черновик') {
        return competition.status;
      }
      const now = new Date();
      const regStart = new Date(competition.registration_start_date);
      const regEnd = new Date(competition.registration_end_date);
      const compStart = new Date(competition.start_date);
      const compEnd = new Date(competition.end_date);
      
      if (now < regStart) return 'скоро_открытие';
      if (now >= regStart && now <= regEnd) return 'открыта_регистрация';
      if (now > regEnd && now < compStart) return 'регистрация_закрыта';
      if (now >= compStart && now <= compEnd) return 'идет_соревнование';
      return 'завершено';
    };

    const status = getStatus();

    if (filters.type && competition.type !== filters.type) return false;
    if (filters.discipline_id && competition.discipline_id !== parseInt(filters.discipline_id)) return false;
    if (filters.search && !competition.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    
    if (filters.status) {
      if (filters.status === 'черновик' || filters.status === 'опубликовано') {
        if (competition.status !== filters.status) return false;
      } else {
        if (status !== filters.status) return false;
      }
    }
    
    return true;
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const resetFilters = () => {
    setFilters({
      type: '',
      status: '',
      discipline_id: '',
      search: ''
    });
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-0">Соревнования</h1>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              onClick={toggleFilters}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition sm:hidden"
            >
              {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
            </button>
            
            {userRole !== 'athlete' && (
              <Link
                to="/competitions/create"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-center"
              >
                Создать соревнование
              </Link>
            )}
          </div>
        </div>
        
        <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6 sm:mb-8 ${!showFilters ? 'hidden sm:block' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Поиск по названию</label>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                placeholder="Введите название"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Тип соревнования</label>
              <select
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="">Все типы</option>
                <option value="открытое">Открытое</option>
                <option value="региональное">Региональное</option>
                <option value="федеральное">Федеральное</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Статус</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="">Все статусы</option>
                <option value="черновик">Черновик</option>
                <option value="опубликовано">Опубликовано</option>
                <option value="открыта_регистрация">Регистрация открыта</option>
                <option value="идет_соревнование">Идет соревнование</option>
                <option value="завершено">Завершено</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">Дисциплина</label>
              <select
                name="discipline_id"
                value={filters.discipline_id}
                onChange={handleFilterChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              >
                <option value="">Все дисциплины</option>
                {disciplines.map(discipline => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
              >
                Сбросить фильтры
              </button>
              
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-10">
            <div className="text-lg text-gray-400">Загрузка соревнований...</div>
          </div>
        ) : error ? (
          <div className="text-center py-10 bg-red-900 text-white rounded-lg">
            <div className="text-lg">{error}</div>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md"
            >
              Попробовать снова
            </button>
          </div>
        ) : filteredCompetitions.length === 0 ? (
          <div className="text-center py-10 bg-gray-800 rounded-lg">
            <div className="text-lg text-gray-400">
              {Object.values(filters).some(v => v) 
                ? 'Нет соревнований, соответствующих выбранным фильтрам' 
                : 'Нет доступных соревнований'}
            </div>
            {Object.values(filters).some(v => v) && (
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Сбросить фильтры
              </button>
            )}
            {userRole !== 'athlete' && (
              <Link
                to="/competitions/create"
                className="mt-4 ml-0 sm:ml-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
              >
                Создать соревнование
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCompetitions.map(competition => (
              <CompetitionCard 
                key={competition.id} 
                competition={competition} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionsList;