import { AppService } from './service';

export const auth = {
  getCurrentUser: () => AppService.getCurrentUser(),
  login: (email: string, pass: string) => AppService.login(email, pass),
  logout: () => AppService.logout(),
};
