// src/components/TeamApplicationForm.jsx (обновленный)
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const TeamApplicationForm = ({ competitionId, user, onSuccess, onCancel }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isIncomplete, setIsIncomplete] = useState(false);
  const [requiredMembers, setRequiredMembers] = useState('');
  const [rolesNeeded, setRolesNeeded] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [competition, setCompetition] = useState(null);
  const [userRegion, setUserRegion] = useState(null);

  // Загрузка данных соревнования и пользователя
  useEffect(() => {
    const fetchCompetitionAndUserData = async () => {
      try {
        // Загрузка данных соревнования
        const { data: competitionData, error: competitionError } = await supabase
          .from('competitions')
          .select('id, type, region_id')
          .eq('id', competitionId)
          .single();
        
        if (competitionError) throw competitionError;
        setCompetition(competitionData);
        
        // Загрузка данных пользователя, включая регион
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, region_id')
          .eq('id', user.id)
          .single();
        
        if (userError) throw userError;
        setUserRegion(userData.region_id);
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err.message);
        setError('Не удалось загрузить необходимые данные.');
      }
    };
    
    if (competitionId && user) {
      fetchCompetitionAndUserData();
    }
  }, [competitionId, user]);

  // Загрузка команд пользователя
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // Базовый запрос для получения команд
        let query = supabase
          .from('teams')
          .select(`
            id, 
            name,
            captain_user_id,
            users!teams_captain_user_id_fkey(region_id)
          `)
          .eq('captain_user_id', user.id);
        
        // Получаем команды
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Фильтруем команды по региону для регионального соревнования
        let filteredTeams = data || [];
        if (competition && competition.type === 'региональное' && competition.region_id) {
          filteredTeams = filteredTeams.filter(team => {
            // Проверяем регион капитана команды
            return team.users?.region_id === competition.region_id;
          });
        }
        
        // Исключаем команды, от которых уже поданы заявки
        const teamIds = filteredTeams.map(team => team.id);
        if (teamIds.length > 0) {
          const { data: existingApps } = await supabase
            .from('applications')
            .select('applicant_team_id')
            .eq('competition_id', competitionId)
            .in('applicant_team_id', teamIds);
          
          const appliedTeamIds = existingApps ? existingApps.map(app => app.applicant_team_id) : [];
          filteredTeams = filteredTeams.filter(team => !appliedTeamIds.includes(team.id));
        }
        
        setTeams(filteredTeams);
      } catch (error) {
        console.error('Ошибка при загрузке команд:', error.message);
        setError('Не удалось загрузить список команд.');
      }
    };

    if (user && competition) {
      fetchTeams();
    }
  }, [user, competitionId, competition]);

  // Проверка, может ли команда участвовать в соревновании
  const canTeamApply = async (teamId) => {
    // Для открытого соревнования - все могут участвовать
    if (!competition || competition.type === 'открытое') {
      return true;
    }
    
    // Для регионального соревнования - проверка региона
    if (competition.type === 'региональное') {
      try {
        // Получаем всех участников команды
        const { data: members, error: membersError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId);
        
        if (membersError) throw membersError;
        
        // Если есть участники, проверяем их регионы
        if (members && members.length > 0) {
          const memberIds = members.map(member => member.user_id);
          
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('region_id')
            .in('id', memberIds);
          
          if (usersError) throw usersError;
          
          // Проверяем, что все участники из нужного региона
          const allFromRegion = users.every(user => user.region_id === competition.region_id);
          return allFromRegion;
        }
        
        // Если участников нет, проверяем только регион капитана
        return userRegion === competition.region_id;
      } catch (err) {
        console.error('Ошибка при проверке региона команды:', err.message);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!selectedTeamId) {
        throw new Error('Выберите команду.');
      }

      // Проверка, может ли команда участвовать
      const canApply = await canTeamApply(selectedTeamId);
      if (!canApply) {
        throw new Error('Эта команда не может участвовать в данном соревновании. Проверьте, что все участники команды из требуемого региона.');
      }

      // Проверка на существующие заявки
      const { data: existingApplication, error: checkError } = await supabase
        .from('applications')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('applicant_team_id', selectedTeamId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      if (existingApplication) {
        throw new Error('Заявка от этой команды уже подана.');
      }

      // Создание заявки
      const applicationData = {
        competition_id: competitionId,
        applicant_team_id: selectedTeamId,
        applicant_user_id: null,
        application_type: 'командная',
        submitted_by_user_id: user.id,
        status: isIncomplete ? 'формируется' : 'на_рассмотрении',
        submitted_at: new Date().toISOString(),
        additional_data: isIncomplete
          ? JSON.stringify({
              required_members: requiredMembers,
              roles_needed: rolesNeeded,
            })
          : null,
      };

      const { error: insertError } = await supabase
        .from('applications')
        .insert([applicationData]);

      if (insertError) throw insertError;

      alert('Заявка успешно подана!');
      onSuccess();
    } catch (error) {
      console.error('Ошибка при подаче заявки:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Подача командной заявки</h2>
      
      {/* Предупреждение для региональных соревнований */}
      {competition && competition.type === 'региональное' && (
        <div className="mb-4 p-3 bg-yellow-900 text-yellow-100 rounded-md">
          <p className="text-sm">
            Внимание! Для участия в региональном соревновании все члены команды должны быть из региона проведения соревнования.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-300 mb-1">Выберите команду *</label>
          {teams.length === 0 ? (
            <div className="p-3 bg-gray-700 text-gray-400 rounded">
              {competition && competition.type === 'региональное' 
                ? 'У вас нет доступных команд из нужного региона'
                : 'У вас нет доступных команд'}
            </div>
          ) : (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Выберите команду</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={isIncomplete}
              onChange={(e) => setIsIncomplete(e.target.checked)}
              className="form-checkbox text-blue-500"
            />
            <span className="ml-2">Команда не полностью сформирована</span>
          </label>
        </div>

        {isIncomplete && (
          <>
            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Количество требуемых участников</label>
              <input
                type="number"
                value={requiredMembers}
                onChange={(e) => setRequiredMembers(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                placeholder="Например, 2"
                min="1"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-300 mb-1">Требуемые роли</label>
              <textarea
                value={rolesNeeded}
                onChange={(e) => setRolesNeeded(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                placeholder="Опишите, какие роли нужны (например, разработчик, дизайнер)"
                rows="3"
              />
            </div>
          </>
        )}

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
            disabled={loading || teams.length === 0 || !selectedTeamId}
          >
            {loading ? 'Отправка...' : 'Отправить заявку'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamApplicationForm;