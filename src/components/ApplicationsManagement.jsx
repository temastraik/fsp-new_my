// src/components/ApplicationsManagement.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from './Navbar';

const ApplicationsManagement = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchCompetitionAndApplications = async () => {
      if (!id || !user) return;

      try {
        setLoading(true);

        // Получение данных соревнования
        const { data: competitionData, error: competitionError } = await supabase
          .from('competitions')
          .select(`
            *,
            disciplines(name),
            regions(name)
          `)
          .eq('id', id)
          .single();

        if (competitionError) {
          console.error('Ошибка загрузки соревнования:', competitionError);
          throw new Error(`Ошибка загрузки соревнования: ${competitionError.message}`);
        }

        setCompetition(competitionData);

        if (competitionData.organizer_user_id !== user.id) {
          console.warn('Доступ запрещен: пользователь не является организатором', {
            userId: user?.id,
            organizerId: competitionData.organizer_user_id,
          });
          throw new Error('У вас нет прав для управления заявками на это соревнование');
        }

        // Получение базовых данных заявок
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('applications')
          .select(`
            id,
            application_type,
            applicant_user_id,
            applicant_team_id,
            status,
            submitted_at,
            submitted_by_user_id,
            additional_data
          `)
          .eq('competition_id', id)
          .order('submitted_at', { ascending: false });

        if (applicationsError) {
          console.error('Ошибка загрузки заявок:', applicationsError);
          throw new Error(`Ошибка загрузки заявок: ${applicationsError.message}`);
        }

        // Получение связанных данных
        const applicantUserIds = applicationsData
          .filter(app => app.applicant_user_id)
          .map(app => app.applicant_user_id);
        const submittedByUserIds = applicationsData
          .filter(app => app.submitted_by_user_id)
          .map(app => app.submitted_by_user_id);
        const teamIds = applicationsData
          .filter(app => app.applicant_team_id)
          .map(app => app.applicant_team_id);

        // Получение данных пользователей (applicant_user_id и submitted_by_user_id)
        const allUserIds = [...new Set([...applicantUserIds, ...submittedByUserIds])];
        let usersData = {};
        if (allUserIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select(`
              id,
              full_name,
              email,
              role,
              region_id,
              regions!users_region_id_fkey(name)
            `)
            .in('id', allUserIds);

          if (usersError) {
            console.error('Ошибка загрузки пользователей:', usersError);
            throw new Error(`Ошибка загрузки пользователей: ${usersError.message}`);
          }

          usersData = users.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {});
        }

        // Получение данных команд
        let teamsData = {};
        if (teamIds.length > 0) {
          const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select(`
              id,
              name,
              captain_user_id,
              users!teams_captain_user_id_fkey(id, full_name, email, region_id, regions!users_region_id_fkey(name))
            `)
            .in('id', teamIds);

          if (teamsError) {
            console.error('Ошибка загрузки команд:', teamsError);
            throw new Error(`Ошибка загрузки команд: ${teamsError.message}`);
          }

          teamsData = teams.reduce((acc, team) => {
            acc[team.id] = team;
            return acc;
          }, {});
        }

        // Объединение данных
        const enrichedApplications = applicationsData.map(app => ({
          ...app,
          users_applicant_user_id: app.applicant_user_id ? usersData[app.applicant_user_id] : null,
          users_submitted_by_user_id: app.submitted_by_user_id ? usersData[app.submitted_by_user_id] : null,
          teams: app.applicant_team_id ? teamsData[app.applicant_team_id] : null,
        }));

        console.log('Обогащенные заявки:', enrichedApplications);
        setApplications(enrichedApplications || []);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error.message);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitionAndApplications();
  }, [id, user]);

  const handleStatusChange = async (applicationId, newStatus) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        console.error('Ошибка обновления статуса:', error);
        throw error;
      }

      setApplications(applications.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));

      alert(`Статус заявки изменен на "${newStatus}"`);
    } catch (error) {
      console.error('Ошибка при изменении статуса заявки:', error.message);
      setError(`Не удалось изменить статус заявки: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  const getApplicationTypeTitle = (type) => {
    return type === 'командная' ? 'Командная заявка' : 'Индивидуальная заявка';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'на_рассмотрении':
        return 'bg-yellow-900 text-yellow-300';
      case 'одобрена':
        return 'bg-green-900 text-green-300';
      case 'отклонена':
        return 'bg-red-900 text-red-300';
      case 'отменена':
        return 'bg-gray-700 text-gray-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  if (loading && !competition) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  if (error && !competition) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        {competition && (
          <>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Управление заявками</h1>
                <h2 className="text-lg text-gray-400 mt-1">{competition.name}</h2>
              </div>
              <div className="mt-4 sm:mt-0">
                <Link
                  to={`/competitions/${id}`}
                  className="text-gray-300 hover:text-white"
                >
                  ← К соревнованию
                </Link>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900 text-white rounded-lg">
                {error}
              </div>
            )}

            <div className="mb-6">
              <div className="border-b border-gray-700">
                <nav className="flex -mb-px">
                  <button
                    className={`mr-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      !activeTab ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab(null)}
                  >
                    Все
                  </button>
                  <button
                    className={`mr-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'на_рассмотрении' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('на_рассмотрении')}
                  >
                    На рассмотрении
                  </button>
                  <button
                    className={`mr-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'одобрена' ? 'border-green-500 text-green-500' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('одобрена')}
                  >
                    Одобренные
                  </button>
                  <button
                    className={`mr-2 py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'отклонена' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('отклонена')}
                  >
                    Отклоненные
                  </button>
                </nav>
              </div>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-10 bg-gray-800 rounded-lg">
                <p className="text-lg text-gray-400">Нет заявок на участие в соревновании</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications
                  .filter(app => !activeTab || app.status === activeTab)
                  .map(app => (
                    <div key={app.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                        <div>
                          <div className="flex items-center mb-2">
                            <span className="px-2 py-1 mr-2 rounded-full text-xs bg-gray-700 text-gray-300">
                              {getApplicationTypeTitle(app.application_type)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(app.status)}`}>
                              {app.status}
                            </span>
                          </div>

                          {app.application_type === 'командная' ? (
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold">{app.teams?.name || 'Команда'}</h3>
                              <p className="text-sm text-gray-400">
                                Капитан: {app.teams?.users?.full_name || app.teams?.users?.email || 'Неизвестно'}
                              </p>
                              {app.teams?.users?.regions && (
                                <p className="text-sm text-gray-400">
                                  Регион: {app.teams?.users?.regions?.name || 'Не указан'}
                                </p>
                              )}
                              {app.users_submitted_by_user_id?.role === 'regional_rep' &&
                              app.users_submitted_by_user_id?.id !== app.teams?.captain_user_id && (
                                <div className="mt-2 p-2 bg-blue-900 bg-opacity-50 rounded-md">
                                  <p className="text-sm">
                                    <span className="font-semibold">Заявка подана региональным представителем:</span> {app.users_submitted_by_user_id?.full_name || app.users_submitted_by_user_id?.email}
                                  </p>
                                  <p className="text-sm text-gray-400">
                                    Регион: {app.users_submitted_by_user_id?.regions?.name || 'Не указан'}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold">{app.users_applicant_user_id?.full_name || 'Участник'}</h3>
                              <p className="text-sm text-gray-400">
                                Email: {app.users_applicant_user_id?.email || 'Неизвестно'}
                              </p>
                              {app.users_applicant_user_id?.regions && (
                                <p className="text-sm text-gray-400">
                                  Регион: {app.users_applicant_user_id?.regions?.name || 'Не указан'}
                                </p>
                              )}
                              {app.users_submitted_by_user_id?.role === 'regional_rep' &&
                                app.users_submitted_by_user_id?.id !== app.applicant_user_id && (
                                  <div className="mt-2 p-2 bg-blue-900 bg-opacity-50 rounded-md">
                                    <p className="text-sm">
                                      <span className="font-semibold">Заявка подана региональным представителем:</span> {app.users_submitted_by_user_id?.full_name || app.users_submitted_by_user_id?.email}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      Регион: {app.users_submitted_by_user_id?.regions?.name || 'Не указан'}
                                    </p>
                                  </div>
                                )}
                            </div>
                          )}

                          {app.application_type === 'командная' && app.status === 'формируется' && app.additional_data && (
                            <div className="mb-4 p-2 bg-gray-700 rounded-md text-sm">
                              <p className="font-semibold">Команда ищет участников:</p>
                              <p className="text-gray-400">
                                Требуется: {app.additional_data?.required_members || '-'} участников
                              </p>
                              <p className="text-gray-400">
                                Роли: {app.additional_data?.roles_needed || '-'}
                              </p>
                            </div>
                          )}

                          <p className="text-sm text-gray-500">
                            Заявка подана: {formatDate(app.submitted_at)}
                          </p>
                        </div>

                        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
                          {app.status === 'на_рассмотрении' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(app.id, 'одобрена')}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition text-sm"
                                disabled={loading}
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => handleStatusChange(app.id, 'отклонена')}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition text-sm"
                                disabled={loading}
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                          {app.status === 'одобрена' && (
                            <button
                              onClick={() => handleStatusChange(app.id, 'отклонена')}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition text-sm"
                              disabled={loading}
                            >
                              Отменить участие
                            </button>
                          )}
                          {app.status === 'отклонена' && (
                            <button
                              onClick={() => handleStatusChange(app.id, 'одобрена')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition text-sm"
                              disabled={loading}
                            >
                              Восстановить
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ApplicationsManagement;
