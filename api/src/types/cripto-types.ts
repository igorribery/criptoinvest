export type TokenPayload = {
    sub: string;
    email: string;
    exp: number;
  };

export type VerifyPassword = {
    password: string, 
    storedHash: string
};

export type SignToken = {
    userId: string,
    email: string
};