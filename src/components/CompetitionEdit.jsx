// src/components/CompetitionEdit.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

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
      console.error('ОшибкаTeamApplicationForm.jsx при парсинге даты:', error);
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
          <path d="M6 3a1 1 0 00-1 1v1H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-1V4a1 1 0 10-2 0v1H7V4a1 1 0 00-1-1zm13 4H5v12h14V7z" />
          <path d="M9 11H7v2h2v-2z" />
          <path d="M13 11h-2v2h2v-2z" />
          <path d="M17 11h-2v2h2v-2z" />
          <path d="M9 15H7v2h2v-2z" />
          <path d="M13 15h-2v2h2v-2z" />
      </div>
    </div>
  );
};
const CompetitionEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState([]);
  const [regions, setRegions] = useState([]);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discipline_id: '',
    type: '',
    region_id: null,
    registration_start_date: '',
    registration_end_date: '',
    start_date: '',
    end_date: '',
    max_participants_or_teams: '',
    status: '',
    participation_type: 'смешанное'
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
      try {
        setLoading(true);
        console.log('Загрузка данных для редактирования соревнования:', { competitionId: id });

        const [disciplinesResponse, regionsResponse] = await Promise.all([
          supabase.from('disciplines').select('id, name'),
          supabase.from('regions').select('id, name')
        ]);

        if (disciplinesResponse.error) throw disciplinesResponse.error;
        if (regionsResponse.error) throw regionsResponse.error;

        setDisciplines(disciplinesResponse.data || []);
        setRegions(regionsResponse.data || []);

        const { data: competitionData, error: competitionError } = await supabase
          .from('competitions')
          .select('*')
          .eq('id', id)
          .single();

        if (competitionError) throw competitionError;

        if (competitionData.organizer_user_id !== user?.id) {
          console.warn('Попытка редактирования чужого соревнования:', { userId: user?.id, organizerId: competitionData.organizer_user_id });
          navigate(`/competitions/${id}`);
          return;
        }

        setFormData({
          name: competitionData.name || '',
          description: competitionData.description || '',
          discipline_id: competitionData.discipline_id || '',
          type: competitionData.type || '',
          region_id: competitionData.region_id || null,
          registration_start_date: competitionData.registration_start_date || '',
          registration_end_date: competitionData.registration_end_date || '',
          start_date: competitionData.start_date || '',
          end_date: competitionData.end_date || '',
          max_participants_or_teams: competitionData.max_participants_or_teams || '',
          status: competitionData.status || '',
          participation_type: competitionData.participation_type || 'смешанное'
        });
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error.message);
        setError('Не удалось загрузить данные соревнования. Попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    if (id && user) {
      fetchData();
    }
  }, [id, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'type' && value !== 'региональное') {
      setFormData({
        ...formData,
        [name]: value,
        region_id: null
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleDateChange = (value, field) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Попытка обновления соревнования:', formData);

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

      const { error: updateError } = await supabase
        .from('competitions')
        .update({
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
          status: formData.status,
          updated_at: new Date().toISOString(),
          participation_type: formData.participation_type
        })
        .eq('id', id);

      if (updateError) {
        console.error('Ошибка при обновлении соревнования:', updateError);
        throw new Error(`Не удалось обновить соревнование: ${updateError.message}`);
      }

      console.log('Соревнование успешно обновлено');
      alert('Соревнование успешно обновлено!');
      navigate(`/competitions/${id}`);
    } catch (error) {
      console.error('Ошибка при обновлении соревнования:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы действительно хотите удалить это соревнование? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);
      console.log('Попытка удаления соревнования:', { competitionId: id });

      const { data: applications, error: applicationsError } = await supabase
        .from('applications')
        .select('id, status')
        .eq('competition_id', id);

      if (applicationsError) throw applicationsError;

      const activeApplications = applications?.filter(app =>
        app.status !== 'отклонена' && app.status !== 'отменена'
      );

      if (activeApplications?.length > 0) {
        throw new Error(`У соревнования есть ${activeApplications.length} активных заявок. Сначала нужно отклонить или отменить все заявки.`);
      }

      if (applications?.length > 0) {
        const { error: deleteApplicationsError } = await supabase
          .from('applications')
          .delete()
          .eq('competition_id', id);

        if (deleteApplicationsError) throw deleteApplicationsError;
      }

      const { error: deleteError } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      console.log('Соревнование успешно удалено');
      alert('Соревнование успешно удалено!');
      navigate('/competitions');
    } catch (error) {
      console.error('Ошибка при удалении соревнования:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading && !formData.name) {
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
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-0">Редактирование соревнования</h1>
          <Link
            to={`/competitions/${id}`}
            className="text-gray-300 hover:text-white mb-4 sm:mb-0"
          >
            ← Вернуться к соревнованию
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
                    <option value="">Выберите тип</option>
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
                  <span className="ml-2">Черновик</span>
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
                  <span className="ml-2">Опубликовано</span>
                </label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
              <div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
                  disabled={loading}
                >
                  Удалить соревнование
                </button>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <Link
                  to={`/competitions/${id}`}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition text-center"
                >
                  Отмена
                </Link>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-900 text-white rounded">
                <p className="font-semibold">Ошибка:</p>
                <p>{error}</p>
              </div>
            )}
          </form>
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 mx-4">
                <h3 className="text-xl font-semibold mb-4">Удаление соревнования</h3>
                <p className="mb-6">
                  Вы действительно хотите удалить соревнование "{formData.name}"? Это действие нельзя отменить.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      handleDelete();
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
                    disabled={loading}
                  >
                    {loading ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompetitionEdit;