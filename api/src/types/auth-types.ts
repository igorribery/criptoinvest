export type DbUser = {
    id: string;
    name: string;
    email: string;
    password_hash?: string;
    avatar_url?: string;
    google_id?: string;
    created_at: string;
  };
  
  export type PendingUser = {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    verification_code_hash: string;
    attempt_count: number;
    expires_at: string;
    created_at: string;
  };
  
  export type PendingEmailChange = {
    id: string;
    user_id: string;
    new_email: string;
    verification_code_hash: string;
    attempt_count: number;
    expires_at: string;
  };
  
  export type PendingPasswordReset = {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
  };

  export type GoogleProfile = {
    sub?: string;
    name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
  };

  export type ResetPassword = {
    token?: string;
    newPassword?: string;
  };

  export type CodeVerification = {
    newEmail?: string
    code?: string
  }

  export type pendingChangeOwner = {
    id: string,
    user_id: string
  }

  export type Login = {
    email?: string,
    password?: string
  }