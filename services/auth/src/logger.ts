export const logger = {
  info(obj: object, msg?: string): void {
    console.log(JSON.stringify({ time: new Date().toISOString(), level: 'info', name: 'auth', ...obj, msg }));
  },
  warn(obj: object, msg?: string): void {
    console.warn(JSON.stringify({ time: new Date().toISOString(), level: 'warn', name: 'auth', ...obj, msg }));
  },
  error(obj: object, msg?: string): void {
    console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', name: 'auth', ...obj, msg }));
  }
};
