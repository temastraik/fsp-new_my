// src/components/TeamsList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from './Navbar';

const TeamsList = () => {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [captainTeams, setCaptainTeams] = useState([]);
  const [memberTeams, setMemberTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // Получение текущего пользователя
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data?.user || null);
      } catch (error) {
        console.error('Ошибка при получении пользователя:', error.message);
        setError('Не удалось получить информацию о пользователе');
      }
    };
    
    fetchUser();
  }, []);

  // Загрузка команд пользователя
  useEffect(() => {
    const fetchTeams = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Получаем команды, где пользователь является капитаном
        const { data: captainData, error: captainError } = await supabase
          .from('teams')
          .select(`
            id,
            name,
            created_at,
            team_members(id, user_id)
          `)
          .eq('captain_user_id', user.id);
          
        if (captainError) throw captainError;
        
        // Добавляем количество участников
        const formattedCaptainTeams = captainData.map(team => ({
          ...team,
          memberCount: team.team_members?.length || 0,
          role: 'Капитан'
        }));
        
        setCaptainTeams(formattedCaptainTeams);
        
        // Получаем команды, где пользователь является участником
        const { data: memberData, error: memberError } = await supabase
          .from('team_members')
          .select(`
            teams(
              id,
              name,
              created_at,
              captain_user_id,
              users(full_name, email)
            )
          `)
          .eq('user_id', user.id);
          
        if (memberError) throw memberError;
        
        // Фильтруем и форматируем команды участника
        const formattedMemberTeams = memberData
          .map(item => item.teams)
          .filter(team => team && team.captain_user_id !== user.id) // Исключаем команды, где пользователь капитан
          .map(team => ({
            ...team,
            role: 'Участник',
            captain: team.users?.full_name || team.users?.email || 'Неизвестный капитан'
          }));
        
        setMemberTeams(formattedMemberTeams);
        
        // Объединяем все команды
        setTeams([...formattedCaptainTeams, ...formattedMemberTeams]);
      } catch (error) {
        console.error('Ошибка при загрузке команд:', error.message);
        setError('Не удалось загрузить список команд. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTeams();
  }, [user]);

  // Создание новой команды
  const createTeam = async () => {
    if (!newTeamName.trim()) {
      setError('Введите название команды');
      return;
    }
    
    try {
      setLoading(true);
      
      // Создаем новую команду
      const { data, error } = await supabase
        .from('teams')
        .insert([
          {
            name: newTeamName.trim(),
            captain_user_id: user.id,
            created_at: new Date().toISOString()
          }
        ])
        .select();
        
      if (error) throw error;
      
      // Добавляем новую команду в список
      const newTeam = {
        ...data[0],
        memberCount: 0,
        role: 'Капитан'
      };
      
      setCaptainTeams([newTeam, ...captainTeams]);
      setTeams([newTeam, ...teams]);
      
      // Закрываем модальное окно и очищаем поле
      setShowCreateModal(false);
      setNewTeamName('');
      
      alert('Команда успешно создана!');
    } catch (error) {
      console.error('Ошибка при создании команды:', error.message);
      setError('Не удалось создать команду. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };

  // Показать индикатор загрузки
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
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Мои команды</h1>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
          >
            Создать команду
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-900 text-white rounded-lg">
            {error}
          </div>
        )}
        
        {loading && teams.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-lg text-gray-400">Загрузка команд...</div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-lg text-gray-400 mb-4">
              У вас пока нет команд. Создайте свою команду или присоединитесь к существующей.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
            >
              Создать команду
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div 
                key={team.id} 
                className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-white">{team.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    team.role === 'Капитан' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
                  }`}>
                    {team.role}
                  </span>
                </div>
                
                <div className="mt-4 text-sm text-gray-500">
                  {team.role === 'Участник' && (
                    <div className="flex justify-between">
                      <span>Капитан:</span>
                      <span className="text-gray-400">{team.captain}</span>
                    </div>
                  )}
                  
                  {team.role === 'Капитан' && (
                    <div className="flex justify-between">
                      <span>Участников:</span>
                      <span className="text-gray-400">{team.memberCount}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between mt-1">
                    <span>Создана:</span>
                    <span className="text-gray-400">{formatDate(team.created_at)}</span>
                  </div>
                </div>
                
                <div className="mt-5 flex justify-end">
                  <Link 
                    to={`/teams/${team.id}`}
                    className="text-blue-500 hover:text-blue-400 text-sm"
                  >
                    Подробнее →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Модальное окно создания команды */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 mx-4">
              <h3 className="text-xl font-semibold mb-4">Создание новой команды</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900 text-white rounded-md">
                  {error}
                </div>
              )}
              
              <div className="mb-6">
                <label className="block text-gray-300 mb-1">Название команды *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Введите название команды"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTeamName('');
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition"
                >
                  Отмена
                </button>
                
                <button
                  onClick={createTeam}
                  disabled={loading || !newTeamName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Создание...' : 'Создать команду'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsList;