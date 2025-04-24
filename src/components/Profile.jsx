// src/components/Profile.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regions, setRegions] = useState([]);
  const [editing, setEditing] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Загрузка профиля
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            email,
            role,
            region_id,
            bio,
            created_at,
            regions(name)
          `)
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          const { data: newProfileData, error: insertError } = await supabase
            .from('users')
            .insert([
              {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || '',
                created_at: new Date(),
              },
            ])
            .select()
            .single();

          if (insertError) {
            throw new Error('Не удалось создать профиль пользователя');
          }

          setProfile(newProfileData);
          setFormData({
            full_name: newProfileData.full_name || '',
            bio: newProfileData.bio || '',
          });
        } else if (profileError) {
          throw profileError;
        } else {
          setProfile(profileData);
          setFormData({
            full_name: profileData.full_name || '',
            bio: profileData.bio || '',
          });
        }

        // Загрузка регионов
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name');

        if (regionsError) throw regionsError;
        setRegions(regionsData || []);

        // 1. Индивидуальные результаты
        const { data: individualResults, error: individualError } = await supabase
          .from('competition_results')
          .select(`
            id,
            competition_id,
            user_id,
            team_id,
            place,
            score,
            result_data,
            recorded_at,
            competitions(name, start_date, end_date, discipline_id, disciplines(name), status),
            teams(name)
          `)
          .eq('user_id', user.id)
          .eq('competitions.status', 'завершено');

        if (individualError) {
          throw new Error(`Ошибка загрузки индивидуальных результатов: ${individualError.message}`);
        }

        let historyData = individualResults || [];

        // 2. Командные результаты
        // 2.1. Найти команды, где пользователь — капитан
        const { data: captainTeams, error: captainError } = await supabase
          .from('teams')
          .select('id, name')
          .eq('captain_user_id', user.id);

        if (captainError) {
          throw new Error(`Ошибка загрузки команд (капитан): ${captainError.message}`);
        }

        // 2.2. Найти команды, где пользователь — участник
        const { data: memberTeams, error: memberError } = await supabase
          .from('team_members')
          .select(`
            team_id,
            teams(id, name)
          `)
          .eq('user_id', user.id);

        if (memberError) {
          throw new Error(`Ошибка загрузки команд (участник): ${memberError.message}`);
        }

        // Объединяем команды (капитан + участники), избегая дубликатов
        const allTeams = [...(captainTeams || []), ...(memberTeams?.map(mt => mt.teams) || [])];
        const uniqueTeamIds = [...new Set(allTeams.map(team => team.id))];
        const uniqueTeams = uniqueTeamIds.map(id => allTeams.find(team => team.id === id));

        // 2.3. Получаем результаты для всех команд
        if (uniqueTeamIds.length > 0) {
          const { data: teamResults, error: teamError } = await supabase
            .from('competition_results')
            .select(`
              id,
              competition_id,
              user_id,
              team_id,
              place,
              score,
              result_data,
              recorded_at,
              competitions(name, start_date, end_date, discipline_id, disciplines(name), status),
              teams(name)
            `)
            .in('team_id', uniqueTeamIds)
            .eq('competitions.status', 'завершено');

          if (teamError) {
            throw new Error(`Ошибка загрузки командных результатов: ${teamError.message}`);
          }

          // Добавляем командные результаты, избегая дубликатов
          teamResults.forEach((teamResult) => {
            if (!historyData.some((result) => result.id === teamResult.id)) {
              historyData.push(teamResult);
            }
          });
        }

        // Сортируем результаты по дате записи
        historyData.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

        setHistory(historyData);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error.message);
        setError('Не удалось загрузить профиль или историю участия. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          bio: formData.bio,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: formData.full_name,
        bio: formData.bio,
      });

      setEditing(false);
      alert('Профиль успешно обновлен!');
    } catch (error) {
      console.error('Ошибка при обновлении профиля:', error.message);
      setError('Не удалось обновить профиль. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  if (!user || loading) {
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
          <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-0">Профиль пользователя</h1>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition w-full sm:w-auto text-center"
            >
              Редактировать профиль
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900 text-white rounded">
            <p>{error}</p>
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6">
          {editing ? (
            <div>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Полное имя</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Введите ваше полное имя"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-300 mb-1">О себе</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  rows="4"
                  placeholder="Расскажите о себе и своем опыте"
                ></textarea>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition w-full sm:w-auto text-center"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition w-full sm:w-auto text-center"
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Личная информация</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="mb-4">
                      <span className="block text-gray-400 text-sm">Полное имя</span>
                      <span className="text-lg">{profile?.full_name || 'Не указано'}</span>
                    </div>
                    <div className="mb-4">
                      <span className="block text-gray-400 text-sm">Email</span>
                      <span className="text-lg">{profile?.email}</span>
                    </div>
                    <div className="mb-4">
                      <span className="block text-gray-400 text-sm">Роль</span>
                      <span className="text-lg">
                        {profile?.role === 'athlete'
                          ? 'Спортсмен'
                          : profile?.role === 'regional_rep'
                          ? 'Региональный представитель'
                          : 'Администратор ФСП'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <span className="block text-gray-400 text-sm">Регион</span>
                      <span className="text-lg">{profile?.regions?.name || 'Не указан'}</span>
                    </div>
                    <div className="mb-4">
                      <span className="block text-gray-400 text-sm">Дата регистрации</span>
                      <span className="text-lg">{formatDate(profile?.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">О себе</h2>
                <p className="text-gray-300 whitespace-pre-line">
                  {profile?.bio || 'Информация не указана'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">История участия</h2>
          {history.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-400 text-center py-4">
                У вас пока нет результатов участия в соревнованиях.{' '}
                <Link to="/competitions" className="text-blue-500 hover:underline">
                  Найти соревнования
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(result => (
                <div
                  key={result.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {result.competitions?.name || `Соревнование ${result.competition_id}`}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Дисциплина: {result.competitions?.disciplines?.name || 'Не указана'}
                      </p>
                      <p className="text-sm text-gray-400">
                        Даты: {formatDate(result.competitions?.start_date)} -{' '}
                        {formatDate(result.competitions?.end_date)}
                      </p>
                      {result.team_id && (
                        <p className="text-sm text-gray-400">
                          Команда: {result.teams?.name || 'Название команды не указано'}
                        </p>
                      )}
                      <p className="text-sm text-gray-400">
                        Тип участия: {result.team_id ? 'Командное' : 'Индивидуальное'}
                      </p>
                      <p className="text-sm text-gray-400">
                        Место: {result.place || 'Не указано'}
                      </p>
                      <p className="text-sm text-gray-400">
                        Баллы: {result.score || 'Не указано'}
                      </p>
                      {result.result_data?.details && (
                        <p className="text-sm text-gray-400">
                          Дополнительно: {result.result_data.details}
                        </p>
                      )}
                    </div>
                    {result.competitions && (
                      <Link
                        to={`/competitions/${result.competition_id}`}
                        className="text-blue-500 hover:text-blue-400 text-sm mt-2 sm:mt-0"
                      >
                        Подробнее
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;