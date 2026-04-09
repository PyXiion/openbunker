export type { AuthUser, GuestUser } from '~/services/auth.service';
import { logger } from '~/utils/logger';

export const useAuth = () => {
  logger.log('useAuth: Getting auth service...');
  const { $auth } = useNuxtApp();
  logger.log('useAuth: Got $auth:', !!$auth);

  const auth = $auth as import('~/services/auth.service').AuthService;
  logger.log('useAuth: Cast to AuthService');

  const result = {
    currentUser: auth.currentUser,
    guestUser: auth.guestUser,

    login: auth.login.bind(auth),
    loginWithPopup: auth.loginWithPopup.bind(auth),
    logout: auth.logout.bind(auth),
    handleCallback: auth.handleCallback.bind(auth),
    handleSilentCallback: auth.handleSilentCallback.bind(auth),
    createGuestUser: auth.createGuestUser.bind(auth),
    createShadowUser: auth.createShadowUser.bind(auth),
    upgradeGuestAccount: auth.upgradeGuestAccount.bind(auth),
    restoreSession: auth.restoreSession.bind(auth),
    clearSession: auth.clearSession.bind(auth),

    isAuthenticated: auth.isAuthenticated,
    isGuest: auth.isGuest,
    getAuthToken: () => auth.getAuthToken(),
    getCurrentUser: () => auth.getCurrentUser(),
    getGuestUser: () => auth.getGuestUser(),
  };
  
  logger.log('useAuth: Returning result');
  return result;
};
