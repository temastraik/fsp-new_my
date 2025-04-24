// src/utils/roleUtils.js
import { useState, useEffect } from 'react'; // Добавляем импорт useState и useEffect
import { supabase } from '../supabaseClient';

// Получение роли и региона пользователя
export const getUserRole = async (userId) => {
  try {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('users')
      .select('role, region_id, regions(name)')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Ошибка при получении данных пользователя:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Ошибка при получении роли пользователя:', error);
    return null;
  }
};

// Проверка доступа к созданию соревнований
export const canCreateCompetition = (role) => {
  return role === 'fsp_admin' || role === 'regional_rep';
};

// Проверка доступа к созданию федеральных соревнований
export const canCreateFederalCompetition = (role) => {
  return role === 'fsp_admin';
};

// Проверка доступа к созданию региональных соревнований
export const canCreateRegionalCompetition = (role) => {
  return role === 'fsp_admin' || role === 'regional_rep';
};

// Проверка, может ли пользователь подавать заявки на региональное соревнование
export const canApplyToRegionalCompetition = (userRegionId, competitionRegionId, role) => {
  // Администраторы могут подавать заявки на любые соревнования
  if (role === 'fsp_admin') return true;
  
  // Для всех остальных - только если их регион совпадает с регионом соревнования
  return userRegionId === competitionRegionId;
};

// Проверка, может ли пользователь подавать заявки на федеральное соревнование как региональный представитель
export const canApplyToFederalAsRegionalRep = (role) => {
  return role === 'fsp_admin' || role === 'regional_rep';
};

// Хук для удобного получения роли в компонентах
export const useRole = (user) => {
  const [roleData, setRoleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRoleData(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await getUserRole(user.id);
        setRoleData(data);
      } catch (error) {
        console.error('Ошибка при получении роли:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRole();
  }, [user]);

  return { roleData, loading };
};
