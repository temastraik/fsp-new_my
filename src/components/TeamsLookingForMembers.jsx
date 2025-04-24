import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const TeamsLookingForMembers = ({ competitionId, currentUser }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestStatus, setRequestStatus] = useState({});

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching teams for competitionId:', competitionId);
        console.log('Current user ID:', currentUser?.id);

        // Получаем заявки со статусом 'формируется'
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('applications')
          .select(`
            id,
            applicant_team_id,
            additional_data,
            competition_id,
            teams (
              id,
              name,
              captain_user_id,
              users!teams_captain_user_id_fkey (full_name, email)
            )
          `)
          .eq('competition_id', competitionId)
          .eq('status', 'формируется');

        if (applicationsError) {
          console.error('Applications error:', applicationsError);
          throw applicationsError;
        }

        console.log('Applications Data:', applicationsData);

        if (!applicationsData || applicationsData.length === 0) {
          console.log('No applications found with status "формируется"');
          setTeams([]);
          setLoading(false);
          return;
        }

        // Фильтруем команды, в которых текущий пользователь НЕ является участником
        const filteredTeams = [];
        for (const app of applicationsData) {
          const { data: membersData, error: membersError } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', app.applicant_team_id);

          if (membersError) {
            console.error('Members error:', membersError);
            throw membersError;
          }

          const isMember = membersData.some(member => member.user_id === currentUser.id);
          console.log(`Team ${app.teams?.name}: isMember=${isMember}`);

          if (!isMember) {
            filteredTeams.push(app);
          }
        }

        console.log('Filtered Teams:', filteredTeams);
        setTeams(filteredTeams);
      } catch (err) {
        console.error('Ошибка при загрузке команд:', err.message);
        setError('Не удалось загрузить команды, ищущие участников.');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && competitionId) {
      fetchTeams();
    }
  }, [competitionId, currentUser]);

  const handleJoinRequest = async (teamId, captainUserId) => {
    try {
      setRequestStatus(prev => ({ ...prev, [teamId]: 'loading' }));

      // Проверяем, не отправлял ли пользователь уже запрос
      const { data: existingRequest, error: requestError } = await supabase
        .from('team_join_requests')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', currentUser.id)
        .eq('competition_id', competitionId)
        .single();

      if (requestError && requestError.code !== 'PGRST116') {
        throw requestError;
      }

      if (existingRequest) {
        setRequestStatus(prev => ({ ...prev, [teamId]: 'already_requested' }));
        return;
      }

      // Создаем запрос на вступление
      const { error: insertError } = await supabase
        .from('team_join_requests')
        .insert({
          team_id: teamId,
          user_id: currentUser.id,
          competition_id: competitionId,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setRequestStatus(prev => ({ ...prev, [teamId]: 'success' }));
    } catch (err) {
      console.error('Ошибка при отправке запроса:', err.message);
      setRequestStatus(prev => ({ ...prev, [teamId]: 'error' }));
    }
  };

  if (loading) return <div className="text-gray-400">Загрузка...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (teams.length === 0) return <div className="text-gray-400">Нет команд, ищущих участников.</div>;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4 text-white">Команды, ищущие участников</h2>
      <div className="divide-y divide-gray-700">
        {teams.map(team => {
          const { required_members, roles_needed } = JSON.parse(team.additional_data || '{}');
          const status = requestStatus[team.applicant_team_id];
          const isCaptain = team.teams.captain_user_id === currentUser.id;

          return (
            <div key={team.id} className="py-3">
              <h3 className="font-medium text-white">{team.teams.name}</h3>
              <p className="text-sm text-gray-400">
                Капитан: {team.teams.users?.full_name} ({team.teams.users?.email})
              </p>
              <p className="text-sm text-gray-400">
                Требуется участников: {required_members || 'Не указано'}
              </p>
              <p className="text-sm text-gray-400">
                Роли: {roles_needed || 'Не указано'}
              </p>
              {!isCaptain ? (
                <button
                  onClick={() => handleJoinRequest(team.applicant_team_id, team.teams.captain_user_id)}
                  disabled={status === 'loading' || status === 'success' || status === 'already_requested'}
                  className={`mt-2 px-4 py-2 rounded-md text-sm font-medium
                    ${status === 'success' || status === 'already_requested'
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {status === 'loading' && 'Отправка...'}
                  {status === 'success' && 'Запрос отправлен'}
                  {status === 'already_requested' && 'Запрос уже отправлен'}
                  {status === 'error' && 'Ошибка, попробуйте снова'}
                  {!status && 'Отправить запрос на вступление'}
                </button>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Это ваша команда.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamsLookingForMembers;