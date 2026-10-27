export type UserRole = 'admin' | 'gestor' | 'visitante' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface Contract {
  id: string;
  code: string;
  title: string;
  vendor: string;
  phase: string;
  globalValue: number;
  [key: string]: any;
}

export interface ContractInput {
  [key: string]: any;
}
