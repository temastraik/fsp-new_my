// src/components/CompetitionDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from './Navbar';
import TeamApplicationForm from './TeamApplicationForm';
import TeamsLookingForMembers from './TeamsLookingForMembers';
import RegionalApplicationForm from './RegionalApplicationForm';
import IndividualApplicationForm from './IndividualApplicationForm';
import { canApplyToRegionalCompetition, canApplyToFederalAsRegionalRep } from '../utils/roleUtils';

const CompetitionDetails = () => {
  const { id } = useParams();
  const [competition, setCompetition] = useState(null);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [showTeamApplicationModal, setShowTeamApplicationModal] = useState(false);
  const [showIndividualApplicationModal, setShowIndividualApplicationModal] = useState(false);
  const [showRegionalApplicationModal, setShowRegionalApplicationModal] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select(`
              id,
              full_name,
              email,
              role,
              region_id,
              regions(id, name)
            `)
            .eq('id', data.user.id)
            .single();

          if (!userError) {
            setUserDetails(userData);
          }

          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('captain_user_id', data.user.id);

          if (teamsError) {
            console.error('Ошибка при загрузке команд капитана:', teamsError);
          } else {
            const teams = teamsData.map(team => team.id) || [];
            setUserTeams(teams);
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке пользователя:', error.message);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const fetchApplicationStatus = async () => {
      if (!id || !userTeams || userTeams.length === 0) return;

      try {
        const { data: teamApplications, error } = await supabase
          .from('applications')
          .select('id, applicant_team_id, status')
          .eq('competition_id', id)
          .in('applicant_team_id', userTeams)
          .maybeSingle();

        if (error) {
          console.error('Ошибка при загрузке статуса заявки:', error);
        } else {
          setApplicationStatus(teamApplications ? teamApplications.status : null);
        }
      } catch (error) {
        console.error('Ошибка при загрузке статуса заявки:', error.message);
      }
    };

    fetchApplicationStatus();
  }, [id, userTeams]);

  useEffect(() => {
    const fetchCompetition = async () => {
      try {
        setLoading(true);
        const { data: competitionData, error: competitionError } = await supabase
          .from('competitions')
          .select(`
            *,
            disciplines(name),
            regions(name)
          `)
          .eq('id', id)
          .single();

        if (competitionError) throw competitionError;

        if (competitionData) {
          const { data: organizerData, error: organizerError } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', competitionData.organizer_user_id)
            .single();

          if (!organizerError) {
            competitionData.organizer = organizerData;
          }

          const now = new Date();
          const regStart = new Date(competitionData.registration_start_date);
          const regEnd = new Date(competitionData.registration_end_date);
          const compStart = new Date(competitionData.start_date);
          const compEnd = new Date(competitionData.end_date);

          let computedStatus = '';
          if (isNaN(regStart) || isNaN(regEnd) || isNaN(compStart) || isNaN(compEnd)) {
            computedStatus = 'ошибка';
          } else if (now < regStart) {
            computedStatus = 'скоро_открытие';
          } else if (now >= regStart && now <= regEnd) {
            computedStatus = 'открыта_регистрация';
          } else if (now > regEnd && now < compStart) {
            computedStatus = 'регистрация_закрыта';
          } else if (now >= compStart && now <= compEnd) {
            computedStatus = 'идет_соревнование';
          } else {
            computedStatus = 'завершено';
          }

          if (competitionData.status !== computedStatus && computedStatus !== 'ошибка') {
            const { error: updateError } = await supabase
              .from('competitions')
              .update({ status: computedStatus })
              .eq('id', id);

            if (updateError) {
              console.error('Ошибка при обновлении статуса соревнования:', updateError);
            } else {
              competitionData.status = computedStatus;
            }
          }

          setCompetition(competitionData);

          const { data: resultsData, error: resultsError } = await supabase
            .from('competition_results')
            .select(`
              id,
              competition_id,
              user_id,
              team_id,
              place,
              score,
              result_data,
              users!competition_results_user_id_fkey(id, full_name, email),
              teams!competition_results_team_id_fkey(id, name)
            `)
            .eq('competition_id', id);

          if (resultsError) {
            console.error('Ошибка при загрузке результатов:', resultsError);
            throw resultsError;
          }

          setResults(resultsData || []);
        }
      } catch (error) {
        console.error('Ошибка при загрузке соревнования:', error.message);
        setError('Не удалось загрузить данные соревнования. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCompetition();
    }
  }, [id, user]);

  const handleTeamApplicationSuccess = async () => {
    setShowTeamApplicationModal(false);
    const { data: teamApplications } = await supabase
      .from('applications')
      .select('id, applicant_team_id, status')
      .eq('competition_id', id)
      .in('applicant_team_id', userTeams)
      .maybeSingle();

    if (teamApplications) {
      setApplicationStatus(teamApplications.status);
    }
  };

  const handleIndividualApplicationSuccess = async () => {
    setShowIndividualApplicationModal(false);
    const { data: individualApplication } = await supabase
      .from('applications')
      .select('id, status')
      .eq('competition_id', id)
      .eq('applicant_user_id', user.id)
      .maybeSingle();

    if (individualApplication) {
      setApplicationStatus(individualApplication.status);
    }
  };

  const handleRegionalApplicationSuccess = () => {
    setShowRegionalApplicationModal(false);
    alert('Заявки от региона успешно поданы!');
  };

  const canApplyAsRegionalRep = () => {
    return (
      userDetails &&
      competition &&
      competition.type === 'федеральное' &&
      canApplyToFederalAsRegionalRep(userDetails.role) &&
      getCompetitionStatus() === 'открыта_регистрация'
    );
  };

  const canApplyAsAthlete = () => {
    if (!userDetails || !competition) {
      return false;
    }

    const status = getCompetitionStatus();
    if (status !== 'открыта_регистрация' || applicationStatus) {
      return false;
    }

    if (competition.participation_type === 'командное' && !userTeams.length) {
      return false;
    }
    if (competition.participation_type === 'индивидуальное' && userTeams.length) {
      return false;
    }

    if (competition.type === 'региональное') {
      return canApplyToRegionalCompetition(
        userDetails.region_id,
        competition.region_id,
        userDetails.role
      );
    }

    return true;
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  const getCompetitionStatus = () => {
    if (!competition) return '';

    const now = new Date();
    const regStart = new Date(competition.registration_start_date);
    const regEnd = new Date(competition.registration_end_date);
    const compStart = new Date(competition.start_date);
    const compEnd = new Date(competition.end_date);

    if (isNaN(regStart) || isNaN(regEnd) || isNaN(compStart) || isNaN(compEnd)) {
      console.error('Некорректные даты в соревновании:', competition);
      return 'ошибка';
    }

    if (now < regStart) return 'скоро_открытие';
    if (now >= regStart && now <= regEnd) return 'открыта_регистрация';
    if (now > regEnd && now < compStart) return 'регистрация_закрыта';
    if (now >= compStart && now <= compEnd) return 'идет_соревнование';
    return 'завершено';
  };

  const allowsIndividual = ['индивидуальное', 'командное_и_индивидуальное'].includes(competition?.participation_type);
  const allowsTeam = ['командное', 'командное_и_индивидуальное'].includes(competition?.participation_type);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        {competition && (
          <>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
              <div>
                <Link to="/competitions" className="text-gray-300 hover:text-white mr-4">
                  ← К списку соревнований
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold">{competition.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      competition.type === 'открытое'
                        ? 'bg-green-900 text-green-300'
                        : competition.type === 'региональное'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-blue-900 text-blue-300'
                    }`}
                  >
                    {competition.type === 'открытое'
                      ? 'Открытое'
                      : competition.type === 'региональное'
                      ? 'Региональное'
                      : competition.type === 'федеральное'
                      ? 'Федеральное'
                      : competition.type}
                  </span>
                  <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded-full text-xs">
                    {competition.disciplines?.name || 'Общая дисциплина'}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      getCompetitionStatus() === 'открыта_регистрация'
                        ? 'bg-green-900 text-green-300'
                        : getCompetitionStatus() === 'идет_соревнование'
                        ? 'bg-blue-900 text-blue-300'
                        : getCompetitionStatus() === 'завершено'
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-yellow-900 text-yellow-300'
                    }`}
                  >
                    {getCompetitionStatus() === 'открыта_регистрация'
                      ? 'Регистрация открыта'
                      : getCompetitionStatus() === 'идет_соревнование'
                      ? 'Идет соревнование'
                      : getCompetitionStatus() === 'завершено'
                      ? 'Завершено'
                      : getCompetitionStatus() === 'регистрация_закрыта'
                      ? 'Регистрация закрыта'
                      : 'Скоро открытие'}
                  </span>
                </div>
              </div>
              <div className="mt-4 md:mt-0">
                <div className="mt-2 md:mt-0 space-y-2 md:space-y-0 md:flex md:space-x-2">
                  {canApplyAsRegionalRep() && (
                    <button
                      onClick={() => setShowRegionalApplicationModal(true)}
                      className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                    >
                      Подать заявку от региона
                    </button>
                  )}
                  {canApplyAsAthlete() && allowsTeam && userTeams.length > 0 && (
                    <button
                      onClick={() => setShowTeamApplicationModal(true)}
                      className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition"
                    >
                      Подать командную заявку
                    </button>
                  )}
                  {allowsTeam && userTeams.length === 0 && getCompetitionStatus() === 'открыта_регистрация' && !applicationStatus && (
                    <div className="mt-2 p-2 bg-yellow-900 text-white text-sm rounded-md">
                      У вас нет команд для участия. Пожалуйста, создайте команду, чтобы подать заявку.{' '}
                      <Link to="/teams/create" className="underline hover:text-gray-300">
                        Создать команду
                      </Link>
                    </div>
                  )}
                  {canApplyAsAthlete() && allowsIndividual && (
                    <button
                      onClick={() => setShowIndividualApplicationModal(true)}
                      className="w-full md:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition"
                    >
                      Подать индивидуальную заявку
                    </button>
                  )}
                </div>
                {competition.type === 'региональное' &&
                  userDetails &&
                  userDetails.region_id !== competition.region_id &&
                  userDetails.role !== 'fsp_admin' &&
                  getCompetitionStatus() === 'открыта_регистрация' && (
                    <div className="mt-2 p-2 bg-red-900 text-white text-sm rounded-md">
                      Это региональное соревнование доступно только для участников из региона:{' '}
                      {competition.regions?.name}
                    </div>
                  )}
                {applicationStatus && (
                  <div className="mt-2 inline-block px-3 py-1 rounded-md bg-gray-800 text-sm">
                    Статус заявки:{' '}
                    <span className="font-semibold">{applicationStatus}</span>
                  </div>
                )}
              </div>
            </div>
            {user && competition && user.id === competition.organizer_user_id && (
              <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Управление соревнованием</h2>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/competitions/${id}/applications`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                  >
                    Просмотр и управление заявками
                  </Link>
                  <Link
                    to={`/competitions/${id}/edit`}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition"
                  >
                    Редактировать соревнование
                  </Link>
                  {getCompetitionStatus() === 'завершено' && (
                    <Link
                      to={`/competitions/${id}/results`}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition"
                    >
                      Ввести результаты
                    </Link>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Описание</h2>
                  <p className="text-gray-300 whitespace-pre-line">
                    {competition.description || 'Описание отсутствует'}
                  </p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Детали соревнования</h2>
                  <div>
                    <p className="text-gray-400 mb-1">Формат участия:</p>
                    <p>
                      {competition.participation_type === 'командное'
                        ? 'Только командное участие'
                        : competition.participation_type === 'индивидуальное'
                        ? 'Только индивидуальное участие'
                        : 'Командное и индивидуальное участие'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 mb-1">Организатор:</p>
                      <p>
                        {competition.organizer?.full_name ||
                          competition.organizer?.email ||
                          'Не указан'}
                      </p>
                    </div>
                    {competition.type === 'региональное' && (
                      <div>
                        <p className="text-gray-400 mb-1">Регион:</p>
                        <p>{competition.regions?.name || 'Не указан'}</p>
                      </div>
                    )}
                    {competition.max_participants_or_teams && (
                      <div>
                        <p className="text-gray-400 mb-1">Максимум участников/команд:</p>
                        <p>{competition.max_participants_or_teams}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 mb-1">Статус соревнования:</p>
                      <p>{competition.status}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4">Даты</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-400 mb-1">Регистрация:</p>
                      <p className="text-green-400">
                        {formatDate(competition.registration_start_date)}
                      </p>
                      <p className="text-red-400 mt-1">
                        {formatDate(competition.registration_end_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Проведение:</p>
                      <p className="text-green-400">{formatDate(competition.start_date)}</p>
                      <p className="text-red-400 mt-1">{formatDate(competition.end_date)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {user && (
              <TeamsLookingForMembers competitionId={id} currentUser={user} />
            )}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Результаты соревнования</h2>
              {results.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <p className="text-gray-400 text-center py-4">
                    Результаты еще не опубликованы.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map(result => (
                    <div
                      key={result.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {result.team_id
                              ? result.teams?.name
                              : result.users?.full_name || result.users?.email}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Тип: {result.team_id ? 'Команда' : 'Индивидуальный участник'}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showTeamApplicationModal && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg max-w-lg w-full p-6 mx-4">
                  <TeamApplicationForm
                    competitionId={id}
                    user={user}
                    onSuccess={handleTeamApplicationSuccess}
                    onCancel={() => setShowTeamApplicationModal(false)}
                  />
                </div>
              </div>
            )}
            {showIndividualApplicationModal && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg max-w-lg w-full p-6 mx-4">
                  <IndividualApplicationForm
                    competitionId={id}
                    user={user}
                    onSuccess={handleIndividualApplicationSuccess}
                    onCancel={() => setShowIndividualApplicationModal(false)}
                  />
                </div>
              </div>
            )}
            {showRegionalApplicationModal && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6 mx-4">
                  <RegionalApplicationForm
                    competitionId={id}
                    user={user}
                    onSuccess={handleRegionalApplicationSuccess}
                    onCancel={() => setShowRegionalApplicationModal(false)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CompetitionDetails;