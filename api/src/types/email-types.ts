export type sendRegisterCodeEmailType = {
    email: string, 
    name: string, 
    code: string
}

export type sendPasswordResetEmailType = {
    email: string, 
    name: string, 
    resetLink: string
}