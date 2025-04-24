// src/components/CompetitionResultsForm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Добавляем useNavigate
import { supabase } from '../supabaseClient';

const CompetitionResultsForm = () => {
  const { id } = useParams();
  const navigate = useNavigate(); // Инициализируем useNavigate
  const [user, setUser] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Получение текущего пользователя
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  // Функция для вычисления статуса соревнования
  const getCompetitionStatus = (competitionData) => {
    const now = new Date();
    const regStart = new Date(competitionData.registration_start_date);
    const regEnd = new Date(competitionData.registration_end_date);
    const compStart = new Date(competitionData.start_date);
    const compEnd = new Date(competitionData.end_date);

    if (isNaN(regStart) || isNaN(regEnd) || isNaN(compStart) || isNaN(compEnd)) {
      console.error('Некорректные даты в соревновании:', competitionData);
      return 'ошибка';
    }

    if (now < regStart) return 'скоро_открытие';
    if (now >= regStart && now <= regEnd) return 'открыта_регистрация';
    if (now > regEnd && now < compStart) return 'регистрация_закрыта';
    if (now >= compStart && now <= compEnd) return 'идет_соревнование';
    return 'завершено';
  };

  // Загрузка данных соревнования и участников
  useEffect(() => {
    const fetchCompetitionAndParticipants = async () => {
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

        if (competitionData.organizer_user_id !== user.id) {
          throw new Error('У вас нет прав для управления результатами этого соревнования');
        }

        const computedStatus = getCompetitionStatus(competitionData);
        if (computedStatus !== 'завершено') {
          throw new Error('Соревнование еще не завершено. Ввод результатов доступен только для завершенных соревнований.');
        }

        setCompetition(competitionData);

        // Получение одобренных заявок
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('applications')
          .select(`
            id,
            application_type,
            applicant_user_id,
            applicant_team_id,
            users!applications_applicant_user_id_fkey(id, full_name, email, region_id, regions!users_region_id_fkey(name)),
            teams!applications_applicant_team_id_fkey(id, name, captain_user_id, users!teams_captain_user_id_fkey(id, full_name, email, region_id, regions!users_region_id_fkey(name)))
          `)
          .eq('competition_id', id)
          .eq('status', 'одобрена');

        if (applicationsError) {
          console.error('Ошибка загрузки заявок:', applicationsError);
          throw new Error(`Ошибка загрузки заявок: ${applicationsError.message}`);
        }

        // Формирование списка участников
        const participantsList = applicationsData.map(app => {
          if (app.application_type === 'командная') {
            return {
              id: app.id,
              type: 'team',
              team_id: app.applicant_team_id,
              name: app.teams?.name,
              captain: app.teams?.users?.full_name || app.teams?.users?.email,
            };
          } else {
            return {
              id: app.id,
              type: 'individual',
              user_id: app.applicant_user_id,
              name: app.users?.full_name || app.users?.email,
            };
          }
        });

        setParticipants(participantsList);

        // Инициализация результатов
        setResults(
          participantsList.map(participant => ({
            application_id: participant.id,
            type: participant.type,
            user_id: participant.user_id || null,
            team_id: participant.team_id || null,
            place: '',
            score: '',
            result_data: '',
          }))
        );
      } catch (error) {
        console.error('Ошибка:', error.message);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitionAndParticipants();
  }, [id, user]);

  // Обработчик изменения полей результатов
  const handleResultChange = (index, field, value) => {
    const updatedResults = [...results];
    updatedResults[index] = { ...updatedResults[index], [field]: value };
    setResults(updatedResults);
  };

  // Обработчик сохранения результатов
  const handleSaveResults = async () => {
    try {
      setLoading(true);

      const resultsToInsert = results.map(result => ({
        competition_id: id,
        user_id: result.user_id || null,
        team_id: result.team_id || null,
        place: result.place ? parseInt(result.place, 10) : null,
        score: result.score ? parseFloat(result.score) : null,
        result_data: result.result_data ? { details: result.result_data } : null,
        recorded_at: new Date().toISOString(),
        recorded_by_user_id: user.id,
      }));

      console.log('Данные для вставки:', resultsToInsert);

      const { error: insertError, data: insertedData } = await supabase
      .from('competition_results')
      .insert(resultsToInsert)
      .select();

      console.log('Результат вставки:', { insertedData, insertError });

      if (insertError) {
        console.error('Ошибка при сохранении результатов:', insertError);
        throw new Error(`Не удалось сохранить результаты: ${insertError.message}`);
      }

      const { error: updateError } = await supabase
        .from('competitions')
        .update({ status: 'результаты_опубликованы' })
        .eq('id', id);

      if (updateError) {
        console.error('Ошибка при обновлении статуса соревнования:', updateError);
        throw new Error(`Не удалось обновить статус соревнования: ${updateError.message}`);
      }

      alert('Результаты успешно сохранены!');
      // Перенаправляем на страницу соревнования
      navigate(`/competitions/${id}`); // Добавляем перенаправление
    } catch (error) {
      console.error('Ошибка:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Ввод результатов: {competition?.name}</h1>
        {participants.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <p className="text-gray-400 text-center py-4">
              Нет одобренных заявок для ввода результатов.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-lg font-semibold mb-3">
                  {result.type === 'team'
                    ? participants.find(p => p.team_id === result.team_id)?.name
                    : participants.find(p => p.user_id === result.user_id)?.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Место</label>
                    <input
                      type="number"
                      value={result.place}
                      onChange={(e) => handleResultChange(index, 'place', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Введите место"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Баллы</label>
                    <input
                      type="number"
                      step="0.01"
                      value={result.score}
                      onChange={(e) => handleResultChange(index, 'score', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Введите баллы"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Дополнительно</label>
                    <input
                      type="text"
                      value={result.result_data}
                      onChange={(e) => handleResultChange(index, 'result_data', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Дополнительные данные"
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => navigate(`/competitions/${id}`)} // Возвращаемся без сохранения
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveResults}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
              >
                Сохранить результаты
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionResultsForm;