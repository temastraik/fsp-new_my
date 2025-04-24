// src/components/RegionalApplicationForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const RegionalApplicationForm = ({ competitionId, user, onSuccess, onCancel }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRegion, setUserRegion] = useState(null);

  // Получаем регион пользователя и команды из этого региона
  useEffect(() => {
    const fetchUserAndTeams = async () => {
      try {
        setLoading(true);
        setError(null);

        // Получаем данные пользователя с регионом
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('region_id, regions(id, name)')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;
        
        // Если у пользователя не указан регион, выдаем ошибку
        if (!userData.region_id) {
          throw new Error('У вас не указан регион в профиле. Пожалуйста, заполните профиль.');
        }

        setUserRegion(userData.regions);

        // Получаем список команд из этого региона
        // Для этого нам нужно найти капитанов из этого региона
        const { data: captainsData, error: captainsError } = await supabase
          .from('users')
          .select('id')
          .eq('region_id', userData.region_id);

        if (captainsError) throw captainsError;

        if (captainsData && captainsData.length > 0) {
          // Получаем ID капитанов
          const captainIds = captainsData.map(captain => captain.id);

          // Получаем команды, где капитаны из этого региона
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select(`
              id,
              name,
              captain_user_id,
              users!teams_captain_user_id_fkey(full_name, email)
            `)
            .in('captain_user_id', captainIds);

          if (teamsError) throw teamsError;

          // Проверяем, не поданы ли уже заявки от этих команд
          const { data: existingApps, error: appsError } = await supabase
            .from('applications')
            .select('applicant_team_id')
            .eq('competition_id', competitionId)
            .in('applicant_team_id', teamsData.map(team => team.id));

          if (appsError) throw appsError;

          // Исключаем команды, от которых уже поданы заявки
          const appliedTeamIds = existingApps ? existingApps.map(app => app.applicant_team_id) : [];
          const availableTeams = teamsData.filter(team => !appliedTeamIds.includes(team.id));

          setTeams(availableTeams || []);
        } else {
          setTeams([]);
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error.message);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (user && competitionId) {
      fetchUserAndTeams();
    }
  }, [user, competitionId]);

  // Обработчик выбора команды
  const handleTeamSelect = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  // Отправка заявок
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedTeams.length === 0) {
      setError('Пожалуйста, выберите хотя бы одну команду');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Создаем массив заявок для выбранных команд
      const applications = selectedTeams.map(teamId => ({
        competition_id: competitionId,
        applicant_team_id: teamId,
        applicant_user_id: null,
        application_type: 'командная',
        submitted_by_user_id: user.id,
        status: 'на_рассмотрении',
        submitted_at: new Date().toISOString(),
      }));

      // Отправляем заявки в базу данных
      const { error: insertError } = await supabase
        .from('applications')
        .insert(applications);

      if (insertError) throw insertError;

      alert(`Заявки успешно поданы от имени региона ${userRegion?.name || ''}`);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Ошибка при подаче заявок:', error.message);
      setError(`Не удалось подать заявки: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Подача заявок от региона</h2>
      {userRegion && (
        <div className="mb-4 bg-gray-700 p-3 rounded-md">
          <p className="text-gray-300">Вы подаете заявки от имени региона: <span className="font-semibold">{userRegion.name}</span></p>
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-4">
          <p className="text-gray-400">Загрузка команд...</p>
        </div>
      ) : error ? (
        <div className="mb-4 p-3 bg-red-900 text-white rounded">
          <p>{error}</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="mb-4 p-3 bg-yellow-900 text-yellow-100 rounded">
          <p>В вашем регионе нет доступных команд для подачи заявок.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <h3 className="text-gray-300 mb-2">Выберите команды:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-gray-700 rounded-md">
              {teams.map(team => (
                <div 
                  key={team.id} 
                  className="flex items-center p-2 hover:bg-gray-600 rounded-md cursor-pointer"
                  onClick={() => handleTeamSelect(team.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(team.id)}
                    onChange={() => {}} // Обработка через onClick на родителе
                    className="mr-3 h-5 w-5"
                  />
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-gray-400">
                      Капитан: {team.users?.full_name || team.users?.email || 'Неизвестно'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900 text-white rounded">
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
              disabled={loading || selectedTeams.length === 0}
            >
              {loading ? 'Отправка...' : 'Отправить заявки'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RegionalApplicationForm;